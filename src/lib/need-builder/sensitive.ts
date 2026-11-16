/**
 * Персональные данные в сообщении компании (из Sana, `challenge-builder/sensitive.ts`).
 *
 * Найденное не маскируется, а останавливает отправку: текст с ПДн не уходит
 * во внешнюю модель, и цитаты сверяются с тем же текстом, что видела модель.
 * Контрольные суммы отсекают бюджеты, артикулы, БИН и прочие длинные числа.
 */

export type SensitiveKind = 'email' | 'phone' | 'iin' | 'card'
export type Finding = { kind: SensitiveKind; excerpt: string }

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu
const PHONE = /(?<![\d])(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\d])/g
const TWELVE_DIGITS = /(?<!\d)\d{12}(?!\d)/g
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g

/**
 * ИИН: 12 цифр, первые шесть — дата рождения ГГММДД, последняя — контрольная.
 * Веса 1..11 по модулю 11; если вышло 10 — веса 3..11,1,2; если снова 10 — номер недействителен.
 * У БИН в 5–6 разрядах тип и признак юрлица, а не день — проверку даты он не проходит.
 */
export function isValidIin(iin: string): boolean {
  if (!/^\d{12}$/.test(iin)) return false
  const d = iin.split('').map(Number)
  const month = d[2] * 10 + d[3]
  const day = d[4] * 10 + d[5]
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]
  let c = w1.reduce((s, w, i) => s + w * d[i], 0) % 11
  if (c === 10) {
    c = w2.reduce((s, w, i) => s + w * d[i], 0) % 11
    if (c === 10) return false
  }
  return c === d[11]
}

export function luhn(digits: string): boolean {
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

const mask = (s: string) => (s.length <= 4 ? '****' : `${s.slice(0, 2)}${'*'.repeat(Math.max(3, s.length - 4))}${s.slice(-2)}`)

export function findSensitive(text: string): Finding[] {
  const out: Finding[] = []
  for (const m of text.matchAll(EMAIL)) out.push({ kind: 'email', excerpt: mask(m[0]) })
  for (const m of text.matchAll(PHONE)) out.push({ kind: 'phone', excerpt: mask(m[0].replace(/\D/g, '')) })
  for (const m of text.matchAll(TWELVE_DIGITS)) if (isValidIin(m[0])) out.push({ kind: 'iin', excerpt: mask(m[0]) })
  for (const m of text.matchAll(CARD)) {
    const digits = m[0].replace(/\D/g, '')
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) out.push({ kind: 'card', excerpt: mask(digits) })
  }
  return out
}

export const SENSITIVE_LABELS: Record<SensitiveKind, string> = {
  email: 'адрес почты',
  phone: 'номер телефона',
  iin: 'ИИН',
  card: 'номер карты',
}
