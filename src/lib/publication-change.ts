import { revalidatePath } from 'next/cache'
import { PublicationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, type AuthUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { reclassifyProject } from '@/lib/search/store'
import { audit } from '@/lib/audit'
import { publicationBlocker } from '@/lib/project-completeness'

/**
 * Смена статуса публикации одного проекта — общая для одиночной кнопки
 * и массового действия в списке, чтобы правила не разошлись.
 *
 * Представитель вуза: DRAFT ⇄ REVIEW (отправить на проверку / вернуть в черновик).
 * Администратор и редактор: любой статус, включая PUBLISHED и снятие с публикации.
 *
 * Индекс поиска и кэш общих страниц сбрасывает вызывающий код: при массовом
 * действии это нужно сделать один раз, а не на каждый проект.
 */

export type PublicationChangeResult =
  | { ok: true; project: { id: string; title: string; publication: PublicationStatus; universityId: string } }
  | { ok: false; status: number; error: string; title?: string }

export async function changePublication(
  user: AuthUser,
  id: string,
  next: PublicationStatus,
  rawNote?: unknown,
): Promise<PublicationChangeResult> {
  const existing = await prisma.project.findUnique({
    where: { id },
    select: {
      universityId: true, title: true, publication: true,
      description: true, status: true, implementedAt: true,
    },
  })
  if (!existing) return { ok: false, status: 404, error: 'Проект не найден' }
  // Название чужого проекта в отказе не возвращаем: это может быть черновик другого вуза
  if (!canAccessUniversity(user, existing.universityId)) {
    return { ok: false, status: 403, error: 'Недостаточно прав для этого проекта' }
  }
  const title = existing.title

  // Публиковать и снимать с публикации может только модератор
  const moderator = canModerate(user)
  if (!moderator && next === PublicationStatus.PUBLISHED) {
    return { ok: false, status: 403, error: 'Публикацию подтверждает администратор. Отправьте проект на проверку.', title }
  }
  if (!moderator && existing.publication === PublicationStatus.PUBLISHED) {
    return { ok: false, status: 403, error: 'Опубликованный проект может снять с публикации только администратор', title }
  }

  // Пустую карточку нельзя ни отправить на проверку, ни опубликовать.
  // Место внедрения требуем только с вуза: модератор должен иметь возможность
  // опубликовать карточки, поданные до появления этого поля.
  // Возврат в черновик и повторное сохранение того же статуса не проверяются.
  if (next !== PublicationStatus.DRAFT && next !== existing.publication) {
    const blocker = publicationBlocker(existing, { requireImplementedAt: !moderator })
    if (blocker) return { ok: false, status: 400, error: blocker, title }
  }

  const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 1000) : ''

  const project = await prisma.project.update({
    where: { id },
    data: {
      publication: next,
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

  await audit(user, 'UPDATE', 'project', project.id, `публикация: ${existing.publication} → ${next}`)

  revalidatePath(`/projects/${project.id}`)
  revalidatePath(`/universities/${project.universityId}`)

  return { ok: true, project }
}
