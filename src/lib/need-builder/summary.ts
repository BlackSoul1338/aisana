import { fieldTitle, NOT_SPECIFIED, NOT_SPECIFIED_KZ, type FieldState } from './readiness'
import type { NeedLang } from './questions'

/**
 * Текст запроса оператору из потребности. Собирает код, а не модель: в запрос
 * попадают только поля, подтверждённые цитатой. Вуз видит этот текст, а не диалог.
 */
const SUMMARY_HEAD: Record<NeedLang, string> = {
  ru: 'Потребность собрана в помощнике подбора.',
  kz: 'Қажеттілік таңдау көмекшісінде жиналған.',
}
const SUMMARY_SCALE: Record<NeedLang, (readiness: number) => string> = {
  ru: r => `Полнота описания: ${r}%.`,
  kz: r => `Сипаттаманың толықтығы: ${r}%.`,
}
const COMMENT_LABEL: Record<NeedLang, string> = {
  ru: 'Комментарий компании',
  kz: 'Компанияның пікірі',
}
const WITHOUT_DETAILS: Record<NeedLang, string> = {
  ru: ' (без подробностей)',
  kz: ' (мәліметсіз)',
}

export function needSummary(fields: FieldState[], readiness: number, comment?: string | null, lang: NeedLang = 'ru'): string {
  const missing = lang === 'kz' ? NOT_SPECIFIED_KZ : NOT_SPECIFIED
  const lines = fields.map(f =>
    `${fieldTitle(f.key, lang)}: ${f.status === 'missing' ? missing : f.value}${f.status === 'weak' ? WITHOUT_DETAILS[lang] : ''}`)
  const parts = [
    SUMMARY_HEAD[lang],
    ...lines,
    SUMMARY_SCALE[lang](readiness),
  ]
  if (comment?.trim()) parts.push('', `${COMMENT_LABEL[lang]}: ${comment.trim()}`)
  return parts.join('\n')
}
