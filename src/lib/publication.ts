import { PublicationStatus, UserRole } from '@prisma/client'

/**
 * Фильтр для ПУБЛИЧНОЙ части портала: посетители видят только
 * опубликованные проекты. Черновики и проекты на проверке доступны
 * лишь в админ-панели — автору из своего вуза и модераторам.
 *
 * Используйте во всех выборках проектов на публичных страницах,
 * в поиске, sitemap и экспорте.
 */
export const PUBLISHED_ONLY = { publication: PublicationStatus.PUBLISHED } as const

/** Тот же фильтр для вложенных связей: university.projects, region... */
export const PUBLISHED_PROJECTS_RELATION = { where: PUBLISHED_ONLY } as const

/** Публикацией и снятием с публикации управляют администратор и редактор. */
export function canModerate(user: { role: UserRole }): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.EDITOR
}

/**
 * Видно ли содержимое проекта пользователю.
 *
 * Опубликованный проект виден всем. Черновик и проект «на проверке» —
 * только модераторам и представителю вуза-владельца.
 *
 * Нужен для вторичных данных проекта (файлы, паспорт, слушания): их
 * отдают отдельные эндпоинты, и без этой проверки черновик читался бы
 * в обход правил видимости самого проекта.
 */
export function canViewProjectContent(
  user: { role: UserRole; universityId?: string | null },
  project: { universityId: string; publication: PublicationStatus },
): boolean {
  if (project.publication === PublicationStatus.PUBLISHED) return true
  if (canModerate(user)) return true
  return user.role === UserRole.UNIVERSITY_REP && user.universityId === project.universityId
}

export const PUBLICATION_LABELS: Record<PublicationStatus, string> = {
  DRAFT: 'Черновик',
  REVIEW: 'На проверке',
  PUBLISHED: 'Опубликован',
}

export const PUBLICATION_BADGE: Record<PublicationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}
