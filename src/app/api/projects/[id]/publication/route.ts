import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { PublicationStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, requireApiRole } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { invalidateSearchIndex, reclassifyProject } from '@/lib/search/store'
import { audit } from '@/lib/audit'

const ALLOWED = new Set<string>(Object.values(PublicationStatus))

/**
 * Смена статуса публикации проекта.
 *
 * Представитель вуза: DRAFT ⇄ REVIEW (отправить на проверку / вернуть в черновик).
 * Администратор и редактор: любой статус, включая PUBLISHED и снятие с публикации.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [
      UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP,
    ])
    if (response) return response

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { universityId: true, title: true, publication: true },
    })
    if (!existing) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    if (!canAccessUniversity(user, existing.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const next = String(body.publication || '')
    if (!ALLOWED.has(next)) {
      return NextResponse.json({ error: 'Неизвестный статус публикации' }, { status: 400 })
    }

    // Публиковать и снимать с публикации может только модератор
    const moderator = canModerate(user)
    if (!moderator && next === PublicationStatus.PUBLISHED) {
      return NextResponse.json(
        { error: 'Публикацию подтверждает администратор. Отправьте проект на проверку.' },
        { status: 403 }
      )
    }
    if (!moderator && existing.publication === PublicationStatus.PUBLISHED) {
      return NextResponse.json(
        { error: 'Опубликованный проект может снять с публикации только администратор' },
        { status: 403 }
      )
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : ''

    const project = await prisma.project.update({
      where: { id },
      data: {
        publication: next as PublicationStatus,
        submittedAt: next === PublicationStatus.REVIEW ? new Date() : undefined,
        publishedAt: next === PublicationStatus.PUBLISHED ? new Date() : undefined,
        // Комментарий модератора актуален, только пока проект не опубликован
        moderationNote: next === PublicationStatus.PUBLISHED ? null : (note || null),
      },
      select: { id: true, title: true, publication: true, universityId: true },
    })

    // Направления считаются по тексту проекта, а текст не менялся —
    // но проект, созданный до появления классификатора, мог остаться
    // без направлений и выпасть из фильтра по теме. Пересчитываем.
    await reclassifyProject(project.id, prisma).catch(err =>
      console.error('Не удалось классифицировать проект', project.id, err))

    // Состав поискового индекса зависит от публикации — сбрасываем кэш
    invalidateSearchIndex()

    await audit(user, 'UPDATE', 'project', project.id, `публикация: ${existing.publication} → ${next}`)

    // Сбрасываем кэш публичных страниц, чтобы изменение было видно сразу
    revalidatePath(`/projects/${project.id}`)
    revalidatePath(`/universities/${project.universityId}`)
    revalidatePath('/projects')
    revalidatePath('/')

    return NextResponse.json(project)
  } catch (error) {
    console.error('Publication change error:', error)
    return NextResponse.json({ error: 'Ошибка смены статуса' }, { status: 500 })
  }
}
