import { z } from 'zod'
import {
  FeedbackStatus, FeedbackTopic, HearingDecision, ProjectCategory, ProjectFileType,
  ProjectIndustry, ProjectStatus, PublicationStatus, UniversityType,
} from '@prisma/client'

/**
 * Схемы тел запросов.
 *
 * Раньше тела проверялись вручную или не проверялись вовсе: неверный
 * enum категории доходил до Prisma и давал 500 вместо 400. Здесь тело
 * разбирается и проверяется до похода в базу.
 */

/** Строка не длиннее N символов; пустая строка превращается в null. */
const shortText = (max: number) =>
  z.string().trim().max(max).nullish().transform(value => value || null)

/**
 * Предел ячейки Excel — 32 767 символов.
 *
 * Поля, которые заполняет импорт из Excel, ограничены не строже ячейки:
 * импорт длину не режет, и проект или вуз с длинным полем иначе нельзя было
 * бы сохранить через форму после импорта.
 */
const EXCEL_CELL_MAX = 32_767

/** Список тегов: импорт берёт их из одной ячейки, поэтому и предел — ячейка. */
const tagsList = z
  .array(z.string().trim().min(1).max(EXCEL_CELL_MAX))
  .max(EXCEL_CELL_MAX)
  .optional()

/** Идентификаторы технологий. */
const technologyIds = z.array(z.string().min(1).max(64)).max(100).optional()

// Формат почты при входе не проверяем: учётки заводились без проверки
// формата, и строгий .email() (требует домен верхнего уровня) закрыл бы
// вход тем, у кого адрес вида user@host. Вход — это просто поиск по базе.
export const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
})

export const feedbackSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  message: z.string().trim().min(10).max(4000),
  organization: shortText(200),
  topic: z.nativeEnum(FeedbackTopic).optional(),
  // Honeypot: поле скрыто от людей, боты его заполняют
  website: z.string().optional(),
})

export const feedbackStatusSchema = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.nativeEnum(FeedbackStatus),
})

export const projectSchema = z.object({
  title: z.string().trim().min(1).max(EXCEL_CELL_MAX),
  description: z.string().trim().min(1).max(EXCEL_CELL_MAX),
  universityId: z.string().trim().min(1).max(64).optional(),
  leadName: shortText(EXCEL_CELL_MAX),
  leadEmail: z.union([z.string().trim().email().max(255), z.literal(''), z.null()]).optional(),
  teamSize: z.coerce.number().int().min(0).max(10_000).nullish(),
  launchDate: z.union([z.string().trim().max(40), z.null()]).optional(),
  category: z.nativeEnum(ProjectCategory).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  // Пустая строка из <select> — «не выбрано»
  industry: z.union([z.nativeEnum(ProjectIndustry), z.literal(''), z.null()]).optional(),
  implementedAt: shortText(2_000),
  isBestPractice: z.boolean().optional(),
  isScalable: z.boolean().optional(),
  impact: shortText(EXCEL_CELL_MAX),
  results: shortText(EXCEL_CELL_MAX),
  presentationPdf: shortText(500),
  presentationPptx: shortText(500),
  zoomLink: shortText(500),
  videoUrl: shortText(500),
  documentation: shortText(500),
  tags: tagsList,
  technologyIds,
})

export const universitySchema = z.object({
  name: z.string().trim().min(1).max(EXCEL_CELL_MAX),
  nameKz: shortText(EXCEL_CELL_MAX),
  shortName: shortText(EXCEL_CELL_MAX),
  regionId: z.string().trim().min(1).max(64),
  address: shortText(EXCEL_CELL_MAX),
  website: shortText(EXCEL_CELL_MAX),
  email: z.union([z.string().trim().email().max(255), z.literal(''), z.null()]).optional(),
  phone: shortText(EXCEL_CELL_MAX),
  rector: shortText(EXCEL_CELL_MAX),
  description: shortText(EXCEL_CELL_MAX),
  type: z.nativeEnum(UniversityType).optional(),
})

/**
 * Правка вуза: все поля необязательные.
 *
 * PUT пишет только то, что реально пришло, — иначе запрос без nameKz
 * обнулял бы его в базе (молчаливая потеря данных).
 */
export const universityUpdateSchema = universitySchema.partial()

export const hearingSchema = z.object({
  projectId: z.string().trim().min(1).max(64),
  date: z.union([z.string().trim().min(1).max(40), z.date()]),
  commission: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  remarks: shortText(5_000),
  recommendations: shortText(5_000),
  decision: z.nativeEnum(HearingDecision).optional(),
  decisionText: shortText(5_000),
})

export const projectFileSchema = z.object({
  label: z.string().trim().min(1).max(300),
  url: z.string().trim().min(1).max(2_000),
  type: z.nativeEnum(ProjectFileType),
  size: z.coerce.number().int().min(0).max(100_000_000).nullish(),
})

export const passportSchema = z.object({
  url: z.union([z.string().trim().max(2_000), z.null()]).optional(),
})

export const publicationSchema = z.object({
  publication: z.nativeEnum(PublicationStatus),
  note: z.string().trim().max(1000).optional(),
})

/** Массовая смена статуса: не больше страницы списка за раз. */
export const bulkPublicationSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(64)).min(1).max(100),
  publication: z.nativeEnum(PublicationStatus),
  note: z.string().trim().max(1000).optional(),
})

export const userCreateSchema = z.object({
  email: z.string().trim().email().max(255),
  name: shortText(200),
  password: z.string().min(6).max(200),
  role: z.enum(['ADMIN', 'EDITOR', 'UNIVERSITY_REP', 'VIEWER']),
  universityId: z.union([z.string().trim().max(64), z.null()]).optional(),
})

export const userUpdateSchema = z.object({
  id: z.string().trim().min(1).max(64),
  email: z.union([z.string().trim().email().max(255), z.literal('')]).optional(),
  name: z.union([z.string().trim().max(200), z.null()]).optional(),
  password: z.union([z.string().min(6).max(200), z.literal('')]).optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'UNIVERSITY_REP', 'VIEWER']).optional(),
  universityId: z.union([z.string().trim().max(64), z.null()]).optional(),
})

/** Тело удаления: во всех таких запросах передаётся только id. */
export const deleteIdSchema = z.object({
  id: z.string().trim().min(1).max(64),
})

export const deleteFileSchema = z.object({
  fileId: z.string().trim().min(1).max(64),
})

export const aiSearchSchema = z.object({
  query: z.string().trim().min(2).max(500),
  debug: z.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

/**
 * Тексты ошибок на русском.
 *
 * Zod по умолчанию отвечает по-английски, а портал русский: сообщение об
 * ошибке показывается пользователю прямо в форме, и «Invalid email» там
 * смотрится чужим.
 */
function issueMessage(issue: z.ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? 'поле обязательно' : 'неверный тип значения'
    case 'invalid_enum_value':
      return `допустимые значения: ${issue.options.join(', ')}`
    case 'too_small':
      if (issue.type === 'string') {
        return issue.minimum === 1 ? 'значение не может быть пустым' : `минимум ${issue.minimum} символов`
      }
      return `минимум ${issue.minimum}`
    case 'too_big':
      if (issue.type === 'string') return `максимум ${issue.maximum} символов`
      if (issue.type === 'array') return `максимум ${issue.maximum} элементов`
      return `максимум ${issue.maximum}`
    case 'invalid_string':
      return issue.validation === 'email' ? 'некорректный адрес почты' : 'некорректное значение'
    default:
      return 'некорректное значение'
  }
}

/**
 * Разбирает тело запроса по схеме.
 *
 * Возвращает union с полем success: только так TypeScript сужает тип —
 * вариант «error: string | null» не сужается, потому что строка не
 * литеральный тип.
 */
export type ParsedBody<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): ParsedBody<z.infer<T>> {
  const result = schema.safeParse(body)
  if (result.success) return { success: true, data: result.data }

  const issue = result.error.issues[0]
  const field = issue.path.join('.')
  const message = field ? `Поле «${field}»: ${issueMessage(issue)}` : issueMessage(issue)
  return { success: false, error: message }
}
