import { IntegrationRequestStatus, IntegrationRequestType, UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { canModerate } from '@/lib/publication'

/**
 * Правила запросов бизнеса по решениям.
 *
 * Маршрут запроса: компания → оператор портала (ADMIN/EDITOR) → вуз-разработчик.
 * Вуз видит запрос только после того, как оператор его передал (forwardedAt),
 * и только по проектам своего вуза. Компания видит лишь свои запросы.
 */

type Actor = { id: string; role: UserRole; universityId?: string | null }

type RequestScope = {
  userId: string | null
  forwardedAt: Date | null
  projectId: string | null
  project: { universityId: string } | null
}

/** Ничего не найдётся: роль без доступа к запросам. */
const NOTHING: Prisma.IntegrationRequestWhereInput = { id: { in: [] } }

export function visibleRequestsWhere(user: Actor): Prisma.IntegrationRequestWhereInput {
  if (canModerate(user)) return {}
  if (user.role === UserRole.BUSINESS_REP) return { userId: user.id }
  if (user.role === UserRole.UNIVERSITY_REP && user.universityId) {
    return { forwardedAt: { not: null }, project: { universityId: user.universityId } }
  }
  return NOTHING
}

/** То же правило для одной уже загруженной записи. */
export function canViewRequest(user: Actor, request: RequestScope): boolean {
  if (canModerate(user)) return true
  if (user.role === UserRole.BUSINESS_REP) return request.userId === user.id
  if (user.role === UserRole.UNIVERSITY_REP && user.universityId) {
    return request.forwardedAt !== null && request.project?.universityId === user.universityId
  }
  return false
}

/** Переходы, доступные вузу: дальше «передан вузу» запрос ведёт он сам. */
const UNIVERSITY_TRANSITIONS: Partial<Record<IntegrationRequestStatus, IntegrationRequestStatus[]>> = {
  SENT_TO_UNIVERSITY: [IntegrationRequestStatus.IN_PROGRESS, IntegrationRequestStatus.DECLINED],
  IN_PROGRESS: [IntegrationRequestStatus.DONE, IntegrationRequestStatus.DECLINED],
}

/**
 * Можно ли перевести запрос в статус `to`.
 *
 * Передать вузу можно только запрос с проектом: без проекта неизвестно,
 * какому вузу он адресован.
 */
export function canChangeStatus(
  user: Actor,
  request: RequestScope & { status: IntegrationRequestStatus },
  to: IntegrationRequestStatus,
): boolean {
  if (request.status === to) return false
  if (to === IntegrationRequestStatus.SENT_TO_UNIVERSITY && !request.projectId) return false
  if (canModerate(user)) return true
  if (user.role === UserRole.UNIVERSITY_REP && canViewRequest(user, request)) {
    return UNIVERSITY_TRANSITIONS[request.status]?.includes(to) ?? false
  }
  return false
}

/** Ответ вуза пишут вуз (по видимому ему запросу) и оператор. */
export function canWriteUniversityNote(user: Actor, request: RequestScope): boolean {
  if (canModerate(user)) return true
  return user.role === UserRole.UNIVERSITY_REP && canViewRequest(user, request)
}

/**
 * Проект запроса меняет только оператор и только до передачи вузу:
 * после передачи смена проекта молча увела бы запрос к другому вузу.
 */
export function canSetProject(user: Actor, request: RequestScope): boolean {
  return canModerate(user) && request.forwardedAt === null
}

export const REQUEST_TYPE_LABELS: Record<IntegrationRequestType, string> = {
  DEMO: 'Демонстрация',
  CONSULTATION: 'Консультация',
  PILOT: 'Пилот',
  INTEGRATION: 'Внедрение',
}

export const REQUEST_TYPE_LABELS_KZ: Record<IntegrationRequestType, string> = {
  DEMO: 'Демонстрация',
  CONSULTATION: 'Консультация',
  PILOT: 'Пилот',
  INTEGRATION: 'Енгізу',
}

export const REQUEST_STATUS_LABELS: Record<IntegrationRequestStatus, string> = {
  NEW: 'Новый',
  IN_REVIEW: 'На проверке',
  SENT_TO_UNIVERSITY: 'Передан вузу',
  IN_PROGRESS: 'В работе',
  DONE: 'Завершён',
  DECLINED: 'Отклонён',
}

export const REQUEST_STATUS_LABELS_KZ: Record<IntegrationRequestStatus, string> = {
  NEW: 'Жаңа',
  IN_REVIEW: 'Тексерілуде',
  SENT_TO_UNIVERSITY: 'ЖОО-ға жіберілді',
  IN_PROGRESS: 'Жұмыста',
  DONE: 'Аяқталды',
  DECLINED: 'Бас тартылған',
}

/** Подпись статуса/типа запроса на языке интерфейса; RU-вариант оставлен для журнала. */
export function requestStatusLabel(status: IntegrationRequestStatus, lang: 'ru' | 'kz' = 'ru'): string {
  return (lang === 'kz' ? REQUEST_STATUS_LABELS_KZ : REQUEST_STATUS_LABELS)[status]
}

export function requestTypeLabel(type: IntegrationRequestType, lang: 'ru' | 'kz' = 'ru'): string {
  return (lang === 'kz' ? REQUEST_TYPE_LABELS_KZ : REQUEST_TYPE_LABELS)[type]
}

export const REQUEST_STATUS_BADGE: Record<IntegrationRequestStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  SENT_TO_UNIVERSITY: 'bg-violet-100 text-violet-700 border-violet-200',
  IN_PROGRESS: 'bg-sky-100 text-sky-700 border-sky-200',
  DONE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DECLINED: 'bg-slate-100 text-slate-600 border-slate-200',
}
