import { FIELD_ORDER, NOT_SPECIFIED, type FieldStatus, type NeedFieldKey, type RawField } from './readiness'

/**
 * Защита от выдуманных фактов (из Sana, `platform/ai/quotes.ts`).
 *
 * Модель обязана подтвердить каждое заполненное поле дословной цитатой из
 * реплик компании. Цитату, которой нет в репликах, код не принимает — поле
 * становится «не указано». Реплики ассистента в сверку не попадают, поэтому
 * модель не может процитировать собственный вопрос.
 */

/** Нормализация для сверки: регистр, ё/е, кавычки, тире, пробелы, пунктуация по краям. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"“”„'‘’`]/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:!?…-]+|[\s.,;:!?…-]+$/g, '')
}

const MIN_QUOTE = 3

/** Цитата из фрагментов через многоточие проверяется по частям. */
export function quoteFound(quote: string, userCorpus: string): boolean {
  const corpus = normalize(userCorpus)
  const parts = quote
    .split(/\s*(?:\.{3}|…)\s*/)
    .map(normalize)
    .filter(part => part.length > 0)
  if (!parts.length || parts.join('').length < MIN_QUOTE) return false
  return parts.every(part => corpus.includes(part))
}

export type AiFieldAssessment = { status: FieldStatus; value: string; quote: string }
export type AiAnalysis = Record<NeedFieldKey, AiFieldAssessment> & {
  questions: { field: NeedFieldKey; text: string }[]
}

/** Поле со статусом ok/weak без подтверждённой цитаты становится missing. */
export function verifyAnalysis(ai: AiAnalysis, businessMessages: string[]): RawField[] {
  const corpus = businessMessages.join('\n')
  return FIELD_ORDER.map(key => {
    const field = ai[key]
    if (field.status === 'missing') {
      return { key, status: 'missing', value: NOT_SPECIFIED, quote: '', quoteVerified: false }
    }
    return quoteFound(field.quote, corpus)
      ? { key, status: field.status, value: field.value.trim() || NOT_SPECIFIED, quote: field.quote.trim(), quoteVerified: true }
      : { key, status: 'missing', value: NOT_SPECIFIED, quote: field.quote.trim(), quoteVerified: false }
  })
}
