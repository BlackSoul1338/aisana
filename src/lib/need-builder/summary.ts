import { FIELD_TITLES, NOT_SPECIFIED, type FieldState } from './readiness'

/**
 * Текст запроса оператору из потребности. Собирает код, а не модель: в запрос
 * попадают только поля, подтверждённые цитатой. Вуз видит этот текст, а не диалог.
 */
export function needSummary(fields: FieldState[], readiness: number, comment?: string | null): string {
  const lines = fields.map(f =>
    `${FIELD_TITLES[f.key]}: ${f.status === 'missing' ? NOT_SPECIFIED : f.value}${f.status === 'weak' ? ' (без подробностей)' : ''}`)
  const parts = [
    'Потребность собрана в помощнике подбора.',
    ...lines,
    `Полнота описания: ${readiness}%.`,
  ]
  if (comment?.trim()) parts.push('', `Комментарий компании: ${comment.trim()}`)
  return parts.join('\n')
}
