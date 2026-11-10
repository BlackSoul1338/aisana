import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Кэш ответов ИИ-модели в Postgres.
 *
 * Не в data-cache.ts: тот живёт в памяти процесса — при рестарте контейнера
 * кэш пуст, а при двух репликах у каждой свой. Ответы модели стоят денег,
 * поэтому им нужно переживать рестарт.
 *
 * В ключ входит хэш промпта. Иначе после правки промпта в коде закэшированные
 * ответы остались бы и показывались как актуальные.
 */

/** Сколько живёт запись кэша. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type CacheKind = 'summary' | 'reasons'

/** Хэш строки — используется и для промпта, и для полезной нагрузки. */
export function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Ключ записи: вид ответа + модель + хэш промпта + хэш данных.
 *
 * Хэш данных (списка проектов) в ключе обязателен: резюме зависит от того,
 * какие проекты попали в выдачу, и для другой выдачи нужен другой ответ.
 */
export function cacheKey(kind: CacheKind, model: string, prompt: string, payload: string): string {
  return `${kind}:${model}:${hash(prompt)}:${hash(payload)}`
}

export interface CacheStats {
  hits: number
  misses: number
}

/** Счётчики попаданий — видно долю кэша в логах. */
const stats: CacheStats = { hits: 0, misses: 0 }

export function getCacheStats(): CacheStats {
  return { ...stats }
}

/**
 * Читает ответ из кэша. Возвращает null, если записи нет или она просрочена.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  const record = await prisma.llmCache.findUnique({ where: { cacheKey: key } })
  if (!record) {
    stats.misses++
    return null
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    // Просроченную запись удаляем — заодно чистим таблицу
    await prisma.llmCache.delete({ where: { cacheKey: key } }).catch(() => null)
    stats.misses++
    return null
  }
  stats.hits++
  return record.payload as T
}

/**
 * Кладёт ответ в кэш. Ошибку записи не поднимаем: потеря кэша — не повод
 * ломать выдачу поиска.
 */
export async function writeCache(
  key: string,
  kind: CacheKind,
  model: string,
  prompt: string,
  payload: unknown,
  ttlMs: number = CACHE_TTL_MS
): Promise<void> {
  try {
    await prisma.llmCache.upsert({
      where: { cacheKey: key },
      update: {
        payload: payload as any,
        expiresAt: new Date(Date.now() + ttlMs),
      },
      create: {
        cacheKey: key,
        kind,
        payload: payload as any,
        model,
        promptHash: hash(prompt),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    })
  } catch (error) {
    console.error('Failed to write LLM cache entry', error)
  }
}

/**
 * Удаляет просроченные записи.
 * Вызывается контейнером backup по расписанию.
 */
export async function purgeExpired(): Promise<number> {
  const result = await prisma.llmCache.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  })
  return result.count
}
