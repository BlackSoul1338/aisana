import crypto from 'crypto'
import { NextRequest } from 'next/server'

// ── In-memory rate limiting / дедупликация ──────────────────
// Работает в рамках одного процесса Next.js (один контейнер app — наш случай).
// При рестарте контейнера счётчики обнуляются — это приемлемый компромисс:
// цель — остановить брутфорс и накрутку, а не идеальная точность.
// Если появятся несколько реплик app — заменить на Redis.

type Bucket = { count: number; resetAt: number }

// Раздельные хранилища для скользящего окна rate-limit и дедупликации (isFirstInWindow).
// Это исключает атаки вытеснения: накрутка просмотров или дедупликации
// не может вытеснить из памяти счётчики защиты от брутфорса паролей (login:acc: / login:ip:).
const rateLimitBuckets = new Map<string, Bucket>()
const dedupBuckets = new Map<string, number>()

const MAX_RATE_LIMIT_BUCKETS = 50_000
const MAX_DEDUP_BUCKETS = 50_000

function cleanupRateLimit(now: number) {
  if (rateLimitBuckets.size < MAX_RATE_LIMIT_BUCKETS) return

  // 1. Удаляем все истёкшие бакеты
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key)
  }
  if (rateLimitBuckets.size < MAX_RATE_LIMIT_BUCKETS) return

  // 2. Если всё ещё переполнено — защищаем активные блокировки учётных записей (login:acc:*)
  // от вытеснения атакующим, генерирующим тысячи случайных IP или других ключей.
  const targetSize = Math.floor(MAX_RATE_LIMIT_BUCKETS * 0.9)
  for (const [key, bucket] of rateLimitBuckets) {
    if (rateLimitBuckets.size <= targetSize) break
    const isProtectedLockout = key.startsWith('login:acc:') && bucket.resetAt > now
    if (!isProtectedLockout) {
      rateLimitBuckets.delete(key)
    }
  }

  // 3. Крайний случай: если даже после этого переполнено — удаляем самые старые записи
  while (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldest = rateLimitBuckets.keys().next().value
    if (oldest === undefined) break
    rateLimitBuckets.delete(oldest)
  }
}

function cleanupDedup(now: number) {
  if (dedupBuckets.size < MAX_DEDUP_BUCKETS) return

  // 1. Удаляем все истёкшие отметки времени
  for (const [key, resetAt] of dedupBuckets) {
    if (resetAt <= now) dedupBuckets.delete(key)
  }
  if (dedupBuckets.size < MAX_DEDUP_BUCKETS) return

  // 2. Если всё ещё переполнено — удаляем старейшие до целевого порога
  const targetSize = Math.floor(MAX_DEDUP_BUCKETS * 0.9)
  for (const [key] of dedupBuckets) {
    if (dedupBuckets.size <= targetSize) break
    dedupBuckets.delete(key)
  }
}

/**
 * Скользящее окно: не более `limit` событий на ключ за `windowMs`.
 * Возвращает ok=false и retryAfterSec, если лимит превышен.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now()
  cleanupRateLimit(now)

  const bucket = rateLimitBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSec: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }

  bucket.count += 1
  return { ok: true, retryAfterSec: 0 }
}

/** Сбрасывает счётчик ключа — например, после успешного входа. */
export function resetRateLimit(key: string): void {
  rateLimitBuckets.delete(key)
  dedupBuckets.delete(key)
}

/**
 * Возвращает одно событие в счётчик: действие сорвалось до полезной работы
 * (ошибка валидации, недоступная модель) и не должно тратить лимит.
 */
export function refundRateLimit(key: string): void {
  const bucket = rateLimitBuckets.get(key)
  if (bucket && bucket.count > 0) bucket.count -= 1
}

/**
 * Дедупликация: true только при ПЕРВОМ вызове с данным ключом в пределах окна.
 * Используется для честных счётчиков (просмотры, попадания в ИИ-поиск).
 * Хранится в отдельном dedupBuckets, изолированно от rateLimit.
 */
export function isFirstInWindow(key: string, windowMs: number): boolean {
  const now = Date.now()
  cleanupDedup(now)

  const resetAt = dedupBuckets.get(key)
  if (resetAt !== undefined && resetAt > now) return false

  dedupBuckets.set(key, now + windowMs)
  return true
}

/**
 * IP клиента для целей ограничения частоты.
 *
 * ВАЖНО: значение нельзя считать достоверным. Заголовок x-forwarded-for
 * клиент подделывает сам (проверено: до контейнера доходит без изменений),
 * а Next 15 больше не отдаёт IP сокета, и за опубликованным портом
 * видно только адрес прокси. Поэтому IP-based лимиты — лишь грубый слой,
 * а настоящую защиту от перебора дают лимиты по аккаунту и по адресу
 * почты, где IP не участвует.
 *
 * Крайняя правая запись цепочки — та, что дописал ближайший к нам прокси.
 * Всё левее контролирует клиент: он может подделать заголовок, чтобы разнести
 * свой лимит по выдуманным адресам. Обратная сторона: за CDN и прокси правым
 * окажется адрес CDN, и все клиенты попадут в одну корзину. Схема прокси на
 * проде отсюда не видна; при её смене сюда нужно вписать доверенный прокси.
 */
export function getClientIp(
  request: NextRequest | { headers: { get(name: string): string | null } }
): string {
  const forwarded = request?.headers?.get?.('x-forwarded-for')
  // Доверяем только крайней правой записи: её добавил ближайший к нам прокси
  // (на Render — балансировщик). Всё левее контролирует клиент и может
  // подделать, чтобы разнести лимит по поддельным адресам.
  // Пустые сегменты пропускаем: заголовок с хвостовой запятой иначе дал бы
  // «unknown» вместо адреса из x-real-ip.
  const parts = forwarded ? forwarded.split(',').map(part => part.trim()).filter(Boolean) : []
  const raw = parts.length ? parts[parts.length - 1] : request?.headers?.get?.('x-real-ip')?.trim()
  if (!raw) return 'unknown'

  // Удаляем пробельные и управляющие символы
  const clean = raw.replace(/[\x00-\x20\x7f]/g, '')
  if (!clean) return 'unknown'

  // Защита от раздувания памяти длинными/поддельными заголовками:
  // допустимый IPv4/IPv6 укладывается в 45 символов (до 64 с портом/scope).
  // Если заголовок длиннее 64 символов — хешируем sha256 в фиксированную 32-символьную строку.
  if (clean.length > 64) {
    return crypto.createHash('sha256').update(clean).digest('hex').slice(0, 32)
  }

  return clean
}
