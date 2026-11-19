/**
 * Персональные данные в сообщении компании (из Sana, `challenge-builder/sensitive.ts`).
 *
 * Найденное не маскируется, а останавливает отправку: текст с ПДн не уходит
 * во внешнюю модель, и цитаты сверяются с тем же текстом, что видела модель.
 * Контрольные суммы отсекают бюджеты, артикулы, БИН и прочие длинные числа;
 * разделители внутри номеров нормализуются до проверки. IBAN Казахстана —
 * с проверкой mod-97-10 (ISO 13616).
 */

export type SensitiveKind = 'email' | 'phone' | 'iin' | 'card' | 'iban'
export type Finding = { kind: SensitiveKind; excerpt: string }

// Домен без точки тоже считаем адресом: в базе есть учётки вида user@host
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?/gu
const PHONE = /(?<![\d])(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\d])/g
// ИИН: 12 цифр с контрольной цифрой; разделители внутри номера допускаем,
// нормализуя их до проверки — «851231 4006 76» тоже ИИН.
const TWELVE_DIGITS = /(?<![\d])(?:\d[\s-]?){11}\d(?![\d])/g
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g
// Кандидат в казахстанский IBAN: KZ + 2 цифры + 16 буквенно-цифровых, разделители допустимы.
const IBAN_KZ = /(?<![A-Za-z0-9])KZ(?:[\s-]?[A-Z0-9]){18}(?![A-Za-z0-9])/gi

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

/** IBAN (ISO 13616): mod-97-10 первых 4 символов в конце, буквы → A=10…Z=35. */
export function isValidIbanKz(raw: string): boolean {
  const iban = raw.replace(/[\s-]/g, '').toUpperCase()
  if (!/^KZ\d{2}[A-Z0-9]{16}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    const chunk = code >= 65 && code <= 90 ? String(code - 55) : ch
    for (const d of chunk) remainder = (remainder * 10 + d.charCodeAt(0) - 48) % 97
  }
  return remainder === 1
}

const mask = (s: string) => (s.length <= 4 ? '****' : `${s.slice(0, 2)}${'*'.repeat(Math.max(3, s.length - 4))}${s.slice(-2)}`)

export function findSensitive(text: string): Finding[] {
  const out: Finding[] = []
  for (const m of text.matchAll(EMAIL)) out.push({ kind: 'email', excerpt: mask(m[0]) })
  for (const m of text.matchAll(PHONE)) out.push({ kind: 'phone', excerpt: mask(m[0].replace(/\D/g, '')) })
  for (const m of text.matchAll(TWELVE_DIGITS)) {
    const digits = m[0].replace(/[\s-]/g, '')
    if (isValidIin(digits)) out.push({ kind: 'iin', excerpt: mask(digits) })
  }
  for (const m of text.matchAll(CARD)) {
    const digits = m[0].replace(/\D/g, '')
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) out.push({ kind: 'card', excerpt: mask(digits) })
  }
  for (const m of text.matchAll(IBAN_KZ)) {
    if (isValidIbanKz(m[0])) out.push({ kind: 'iban', excerpt: mask(m[0].replace(/[\s-]/g, '')) })
  }
  return out
}

export const SENSITIVE_LABELS: Record<SensitiveKind, string> = {
  email: 'адрес почты',
  phone: 'номер телефона',
  iin: 'ИИН',
  card: 'номер карты',
  iban: 'IBAN / расчётный счёт',
}
