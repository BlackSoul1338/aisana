import { PublicationStatus, UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'

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

/**
 * Витрина решений для бизнеса: проект опубликован и открыт для интеграции.
 * Публикация важнее флага — снятый с публикации проект исчезает из витрины.
 */
export const SHOWCASE_WHERE = {
  ...PUBLISHED_ONLY,
  availableForIntegration: true,
} as const

/** То же правило для уже загруженной записи. */
export function isShowcaseProject(project: {
  publication: PublicationStatus
  availableForIntegration: boolean
}): boolean {
  return project.publication === PublicationStatus.PUBLISHED && project.availableForIntegration
}

/** Публикацией и снятием с публикации управляют администратор и редактор. */
export function canModerate(user: { role: UserRole }): boolean {
  return user.role === UserRole.ADMIN || user.role === UserRole.EDITOR
}

/**
 * Вуз, проекты которого пользователь видит помимо опубликованных.
 *
 * Только представитель вуза — и только свой вуз. Проверка роли обязательна:
 * поле universityId есть у любой учётки, и без проверки роли VIEWER с
 * привязанным вузом получил бы доступ к чужим черновикам.
 */
function ownUniversityScope(user: { role: UserRole; universityId?: string | null }): string | null {
  return user.role === UserRole.UNIVERSITY_REP ? user.universityId ?? null : null
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
  return ownUniversityScope(user) === project.universityId
}

/**
 * Фильтр выборки проектов, видимых пользователю.
 *
 * Модераторам видно всё. Остальным — опубликованные проекты и проекты
 * своего вуза, если пользователь — его представитель.
 *
 * Единый источник правила видимости: список проектов, вложенные связи
 * (files, passport, hearings) и выборки по слушаниям фильтруются им,
 * чтобы правило не разъезжалось между эндпоинтами.
 */
export function visibleProjectsWhere(
  user: { role: UserRole; universityId?: string | null },
): Prisma.ProjectWhereInput {
  if (canModerate(user)) return {}

  const ownUniversity = ownUniversityScope(user)
  return {
    OR: [
      { publication: PublicationStatus.PUBLISHED },
      ...(ownUniversity ? [{ universityId: ownUniversity }] : []),
    ],
  }
}

/**
 * Ключ области видимости для кэшей выборок.
 *
 * Набор видимых данных зависит от роли, поэтому кэш выборки делится
 * по ключу: иначе один пользователь увидел бы чужой набор.
 */
export function visibilityScope(user: { role: UserRole; universityId?: string | null }): string {
  if (canModerate(user)) return 'all'
  const ownUniversity = ownUniversityScope(user)
  return ownUniversity ? `university:${ownUniversity}` : 'published'
}

/**
 * Видит ли пользователь почту руководителя проекта.
 *
 * Представитель бизнеса связывается с разработчиком через запрос оператору
 * AiSana, а не напрямую. Остальным ролям проект отдаётся как раньше: ответы
 * API читают внешние клиенты, их форма не меняется.
 */
export function canSeeLeadContacts(user: { role: UserRole }): boolean {
  return user.role !== UserRole.BUSINESS_REP
}

/** Проект без почты руководителя для тех, кому она не положена. */
export function withoutLeadContacts<T extends { leadEmail: string | null }>(
  user: { role: UserRole },
  project: T,
): T {
  return canSeeLeadContacts(user) ? project : { ...project, leadEmail: null }
}

/**
 * Убирает из ответа API служебный флаг витрины: форма ответов /api/projects
 * читается внешними клиентами, и новое поле не должно её менять.
 */
export function withoutIntegrationFlag<T extends { availableForIntegration: boolean }>(
  project: T,
): Omit<T, 'availableForIntegration'> {
  const { availableForIntegration: _flag, ...rest } = project
  return rest
}

export const PUBLICATION_BADGE: Record<PublicationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}
