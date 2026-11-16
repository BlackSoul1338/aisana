import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, requireApiRole, requireApiUser } from '@/lib/auth'
import { deleteUpload } from '@/lib/uploads'
import { invalidateSearchIndex, reclassifyProject } from '@/lib/search/store'
import { audit } from '@/lib/audit'
import { parseBody, projectSchema } from '@/lib/schemas'
import { canModerate } from '@/lib/publication'
import { publicationBlocker } from '@/lib/project-completeness'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Middleware проверяет только НАЛИЧИЕ cookie — настоящая проверка
    // сессии и ролей здесь. Без неё поддельная cookie открывала черновики.
    const { user, response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: { university: { include: { region: true } }, technologies: true, hearings: { orderBy: { date: 'desc' } } },
    })
    if (!project) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

    // Черновик и проект на проверке видны только модераторам и автору из вуза
    if (project.publication !== 'PUBLISHED' && !canAccessUniversity(user, project.universityId)) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch {
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { universityId: true, isBestPractice: true, isScalable: true, publication: true },
    })
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    if (!canAccessUniversity(user, existing.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(projectSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data
    const universityId = user.role === UserRole.UNIVERSITY_REP ? existing.universityId : data.universityId
    if (!universityId) {
      return NextResponse.json({ error: 'Университет обязателен' }, { status: 400 })
    }
    if (!canAccessUniversity(user, universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого вуза' }, { status: 403 })
    }

    // Карточка уже на проверке или опубликована — вуз не может сохранить её
    // пустой или «внедрённой» без места внедрения. Черновик сохраняется как есть.
    // Модератора не блокируем: ему нужно править и карточки, поданные до этого правила.
    if (!canModerate(user) && existing.publication !== 'DRAFT') {
      const blocker = publicationBlocker(data, { requireImplementedAt: true })
      if (blocker) return NextResponse.json({ error: blocker }, { status: 400 })
    }

    // Бейджи видны публично — выдавать их может только модератор
    const maySetBadges = user.role === UserRole.ADMIN || user.role === UserRole.EDITOR

    const project = await prisma.project.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        universityId,
        leadName: data.leadName || null,
        leadEmail: data.leadEmail || null,
        teamSize: data.teamSize ?? null,
        launchDate: data.launchDate ? new Date(data.launchDate) : null,
        category: data.category,
        status: data.status,
        // Отрасль не затираем, если поле не прислали вовсе
        industry: data.industry === undefined ? undefined : (data.industry || null),
        implementedAt: data.implementedAt || null,
        isBestPractice: maySetBadges ? (data.isBestPractice ?? existing.isBestPractice) : existing.isBestPractice,
        isScalable: maySetBadges ? (data.isScalable ?? existing.isScalable) : existing.isScalable,
        impact: data.impact || null,
        results: data.results || null,
        presentationPdf: data.presentationPdf || null,
        presentationPptx: data.presentationPptx || null,
        zoomLink: data.zoomLink || null,
        videoUrl: data.videoUrl || null,
        documentation: data.documentation || null,
        tags: data.tags || [],
        technologies: { set: data.technologyIds?.map((technologyId: string) => ({ id: technologyId })) || [] },
      },
    })
    // Текст изменился — пересчитываем направления и сбрасываем индекс
    await reclassifyProject(project.id, prisma).catch(err =>
      console.error('Не удалось классифицировать проект', project.id, err))
    invalidateSearchIndex()

    await audit(user, 'UPDATE', 'project', project.id, project.title)
    revalidatePath(`/projects/${project.id}`)
    revalidatePath(`/universities/${project.universityId}`)
    return NextResponse.json(project)
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: {
        universityId: true,
        agentPassportPdf: true,
        files: { select: { url: true } },
      },
    })
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    if (!canAccessUniversity(user, existing.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    // hearings и project_files удалятся каскадом (onDelete: Cascade в схеме)
    await prisma.project.delete({ where: { id } })

    // Чистим локально загруженные файлы проекта с диска,
    // чтобы они не оставались сиротами в volume загрузок.
    // Файлы, привязанные к другим проектам, останутся на диске.
    await deleteUpload(existing.agentPassportPdf)
    for (const file of existing.files) {
      await deleteUpload(file.url)
    }

    invalidateSearchIndex()
    await audit(user, 'DELETE', 'project', id)
    revalidatePath(`/projects/${id}`)
    revalidatePath(`/universities/${existing.universityId}`)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
