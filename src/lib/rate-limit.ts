import { NextRequest } from 'next/server'

// ── In-memory rate limiting / дедупликация ──────────────────
// Работает в рамках одного процесса Next.js (один контейнер app — наш случай).
// При рестарте контейнера счётчики обнуляются — это приемлемый компромисс:
// цель — остановить брутфорс и накрутку, а не идеальная точность.
// Если появятся несколько реплик app — заменить на Redis.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 50_000

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  // Если после чистки всё ещё переполнено — удаляем самые старые записи
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value
    if (oldest === undefined) break
    buckets.delete(oldest)
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
  cleanup(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
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
  buckets.delete(key)
}

/**
 * Дедупликация: true только при ПЕРВОМ вызове с данным ключом в пределах окна.
 * Используется для честных счётчиков (просмотры, попадания в ИИ-поиск).
 */
export function isFirstInWindow(key: string, windowMs: number): boolean {
  const now = Date.now()
  cleanup(now)

  const bucket = buckets.get(key)
  if (bucket && bucket.resetAt > now) return false

  buckets.set(key, { count: 1, resetAt: now + windowMs })
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
 * Берём ПЕРВОЕ значение цепочки, как и раньше. Последнее значение надёжнее,
 * но только когда перед приложением ровно один свой прокси (nginx с
 * $proxy_add_x_forwarded_for дописывает адрес клиента в конец). За CDN и
 * прокси последним окажется адрес CDN, и все клиенты попадут в одну корзину
 * лимитов. Схема прокси на проде отсюда не видна, поэтому выбор оставлен
 * прежним; при известной схеме стоит брать адрес, который дописал свой прокси.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
