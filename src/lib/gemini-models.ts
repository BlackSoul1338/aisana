import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'

/**
 * Выбор модели Gemini.
 *
 * Квота Free Tier у моделей разная: у flash — 20 запросов в сутки, у flash-lite —
 * 500. Плюс модели делятся на независимые пулы: когда кончилась квота у
 * gemini-3.6-flash, у gemini-3.5-flash-lite она ещё есть. Поэтому:
 *
 *  - простая задача (краткое резюме) идёт на lite — у неё и запас больше;
 *  - сложная задача (пояснения по проектам) идёт на полный flash;
 *  - при 429 «quota exceeded» или 503 запрос переносится на следующую модель
 *    в цепочке, пока не кончится список.
 *
 * Цепочка зависит от типа задачи: у простой задачи сначала модели lite
 * (большая квота), у сложной — flash (лучше качество JSON по схеме).
 *
 * Модели переопределяются через .env: GEMINI_MODEL (сложные задачи),
 * GEMINI_MODEL_LITE (простые), GEMINI_MODEL_FALLBACKS (цепочка резервных).
 */

/** Тип задачи: от него зависит, какая квотная «корзина» используется первой. */
export type GeminiTaskType = 'summary' | 'reasons'

/** Модель для сложных задач: пояснения по проектам, структурированный JSON. */
export const MODEL_MAIN = process.env.GEMINI_MODEL || 'gemini-3.5-flash'

/** Модель для простых задач: короткое резюме в свободном тексте. */
export const MODEL_LITE = process.env.GEMINI_MODEL_LITE || 'gemini-3.5-flash-lite'

/**
 * Цепочка резервных моделей.
 *
 * Порядок важен: сначала модели с отдельным квотным пулом, потом остальные.
 * gemini-3.5-flash и gemini-3.6-flash делят один пул (проверено: запрос к
 * 3.5-flash отвечает modelVersion 3.6-flash), поэтому подряд их ставить
 * бессмысленно — исчерпание квоты у одного означает исчерпание у другого.
 */
export const MODEL_FALLBACKS: string[] = (
  process.env.GEMINI_MODEL_FALLBACKS ||
  'gemini-3.8-flash,gemini-3-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite'
)
  .split(',')
  .map(name => name.trim())
  .filter(Boolean)

/** Модели, исчерпавшие квоту: до истечения времени к ним не обращаемся. */
const exhausted = new Map<string, number>()

/** На сколько минут запоминать исчерпанную квоту. */
const EXHAUSTED_TTL_MS = 10 * 60 * 1000

/**
 * Ошибка, из-за которой стоит попробовать другую модель:
 * квота исчерпана или модель перегружена.
 *
 * SDK отдаёт её по-разному: у квоты status 429 и «quota exceeded» в тексте,
 * у перегрузки — 503 и «high demand». Смотрим и текст, и статус, и errorDetails.
 */
export function isRetryableModelError(error: unknown): boolean {
  const err = error as { message?: string; status?: number | string; errorDetails?: unknown }

  if (err?.status === 429 || err?.status === 503) return true
  if (err?.status === 'RESOURCE_EXHAUSTED' || err?.status === 'UNAVAILABLE') return true

  const message = String(err?.message || error || '')
  if (/quota|rate limit|resource[_ ]exhausted|high demand|too many requests|UNAVAILABLE|\b429\b|\b503\b/i.test(message)) {
    return true
  }

  // errorDetails приходит строкой или массивом объектов
  const details = JSON.stringify(err?.errorDetails ?? '')
  return /QuotaFailure|RESOURCE_EXHAUSTED|rateLimit/i.test(details)
}

/** Пометить модель как исчерпавшую квоту — на ближайшие минуты. */
function markExhausted(model: string): void {
  exhausted.set(model, Date.now() + EXHAUSTED_TTL_MS)
}

/** Квота модели сейчас исчерпана? */
function isExhausted(model: string): boolean {
  const until = exhausted.get(model)
  if (!until) return false
  if (until <= Date.now()) {
    exhausted.delete(model)
    return false
  }
  return true
}

/**
 * Модели flash-lite: у них отдельная квотная «корзина».
 *
 * Перечислены явно, а не распознаются по подстроке в имени: корзина
 * определяет порядок цепочки, и ошибочная классификация молча переставила
 * бы модели. Модель, которой здесь нет, считается flash — её корзина
 * больше (20 запросов в сутки против 500 у lite).
 */
const LITE_POOL = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
])

/**
 * Квотная корзина модели.
 *
 * 'lite' — запас в 500 запросов в сутки, 'flash' — 20. Корзины независимы:
 * кончилась квота у flash-модели, у lite она ещё есть.
 */
export function quotaPool(model: string): 'flash' | 'lite' {
  return LITE_POOL.has(model) ? 'lite' : 'flash'
}

/**
 * Модели, которые стоит попробовать для задачи, в порядке убывания приоритета.
 *
 * Для простой задачи первыми идут модели lite: у них квота 500 запросов в
 * сутки против 20 у flash. Для сложной — основная flash-модель, а lite идёт
 * в конец: JSON по схеме она отдаёт хуже.
 *
 * Внутри каждой группы порядок берётся из GEMINI_MODEL_FALLBACKS, повторов нет.
 */
export function modelChain(task: GeminiTaskType): string[] {
  const flash = MODEL_FALLBACKS.filter(model => quotaPool(model) === 'flash')
  const lite = MODEL_FALLBACKS.filter(model => quotaPool(model) === 'lite')

  const chain = task === 'summary'
    ? [MODEL_LITE, ...lite, MODEL_MAIN, ...flash]
    : [MODEL_MAIN, ...flash, ...lite]

  return chain.filter((model, index) => chain.indexOf(model) === index)
}

function getClient(): GoogleGenerativeAI | null {
  if (!process.env.GEMINI_API_KEY) return null
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

/**
 * Выполняет запрос к модели, при неудаче переходя на следующую в цепочке.
 *
 * Возвращает null, если не сработала ни одна модель: у всех исчерпана квота
 * или все недоступны. Тогда вызывающий честно сообщает, что ИИ-часть
 * недоступна.
 */
export async function generateWithFallback<T>(
  task: GeminiTaskType,
  buildRequest: (model: GenerativeModel) => T,
  send: (request: T) => Promise<string>
): Promise<{ text: string; model: string } | null> {
  const client = getClient()
  if (!client) return null

  for (const modelName of modelChain(task)) {
    if (isExhausted(modelName)) continue

    try {
      const model = client.getGenerativeModel({ model: modelName })
      const text = await send(buildRequest(model))
      return { text, model: modelName }
    } catch (error) {
      if (!isRetryableModelError(error)) {
        console.error(`Model ${modelName} failed`, error)
        continue
      }
      // Квота или перегрузка: запоминаем модель и пробуем следующую
      markExhausted(modelName)
      console.warn(`Model ${modelName} unavailable (quota or overload), trying next`)
    }
  }

  return null
}
