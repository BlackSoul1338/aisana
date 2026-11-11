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

/**
 * Счётчики попаданий и промахов.
 *
 * Считаются в памяти процесса: после рестарта обнуляются. Для оценки
 * эффективности кэша этого достаточно, а таблица счётчиков в БД была бы
 * лишней сущностью.
 */
const counters = { hits: 0, misses: 0 }

/**
 * Статистика кэша: попадания, промахи и доля попаданий.
 *
 * Диагностика для логов сервера и админ-панели, а не часть ответа API:
 * пользователю статистика кэша ничего не даёт.
 */
export function getLlmCacheStats(): { hits: number; misses: number; hitRate: number } {
  const total = counters.hits + counters.misses
  return {
    ...counters,
    hitRate: total === 0 ? 0 : Math.round((counters.hits / total) * 100) / 100,
  }
}

/** Хэш строки — используется и для промпта, и для полезной нагрузки. */
function hash(value: string): string {
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

/**
 * Читает ответ из кэша. Возвращает null, если записи нет или она просрочена.
 *
 * Ошибку чтения не поднимаем, как и в writeCache: недоступная таблица кэша
 * превратилась бы в 500 для всего поиска вместо простого промаха.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  const record = await prisma.llmCache.findUnique({ where: { cacheKey: key } }).catch(error => {
    console.error('Failed to read LLM cache entry', error)
    return null
  })
  if (!record) {
    counters.misses++
    return null
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    // Просроченную запись удаляем — заодно чистим таблицу
    await prisma.llmCache.delete({ where: { cacheKey: key } }).catch(() => null)
    counters.misses++
    return null
  }

  counters.hits++
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
