import { describe, expect, it } from 'vitest'
import { modelChain, quotaPool, MODEL_MAIN, MODEL_LITE, MODEL_FALLBACKS, isRetryableModelError } from '@/lib/gemini-models'

// Модели lite — отдельная квотная «корзина» с запасом в 500 запросов в сутки
const liteFallbacks = MODEL_FALLBACKS.filter(model => quotaPool(model) === 'lite')

describe('выбор модели', () => {
  it('простая задача идёт на lite-модель первой', () => {
    const chain = modelChain('summary')
    expect(chain[0]).toBe(MODEL_LITE)
  })

  it('сложная задача идёт на основную модель первой', () => {
    const chain = modelChain('reasons')
    expect(chain[0]).toBe(MODEL_MAIN)
  })

  it('в цепочке нет повторов', () => {
    for (const chain of [modelChain('summary'), modelChain('reasons')]) {
      expect(new Set(chain).size).toBe(chain.length)
    }
  })

  it('цепочка содержит резервные модели с отдельной квотой', () => {
    // gemini-3.5-flash и gemini-3.6-flash делят один квотный пул,
    // поэтому в резервной цепочке они не стоят рядом
    const chain = modelChain('reasons')
    const mainIndex = chain.indexOf(MODEL_MAIN)
    const fallbackIndex = chain.indexOf(MODEL_FALLBACKS[0])
    expect(mainIndex).toBe(0)
    expect(fallbackIndex).toBeGreaterThan(mainIndex)
  })

  it('в простой задаче lite-модели идут раньше основной', () => {
    // У flash-lite квота 500 запросов в сутки против 20 у flash,
    // поэтому простую задачу дешевле выполнять на lite
    const chain = modelChain('summary')
    const mainIndex = chain.indexOf(MODEL_MAIN)
    for (const model of liteFallbacks) {
      expect(chain.indexOf(model)).toBeLessThan(mainIndex)
    }
  })

  it('в сложной задаче lite-модели идут в конец цепочки', () => {
    const chain = modelChain('reasons')
    const mainIndex = chain.indexOf(MODEL_MAIN)
    for (const model of liteFallbacks) {
      expect(chain.indexOf(model)).toBeGreaterThan(mainIndex)
    }
  })

  it('в цепочку попадают все резервные модели', () => {
    for (const chain of [modelChain('summary'), modelChain('reasons')]) {
      for (const model of MODEL_FALLBACKS) {
        expect(chain).toContain(model)
      }
    }
  })

  it('модели lite и main по умолчанию разные', () => {
    expect(MODEL_LITE).not.toBe(MODEL_MAIN)
  })
})

describe('распознавание ошибок квоты', () => {
  it('узнаёт исчерпание квоты', () => {
    expect(isRetryableModelError(new Error('You exceeded your current quota'))).toBe(true)
    expect(isRetryableModelError(new Error('Quota exceeded for metric'))).toBe(true)
    expect(isRetryableModelError(new Error('RESOURCE_EXHAUSTED'))).toBe(true)
  })

  it('узнаёт исчерпание квоты по статусу и errorDetails', () => {
    // Так приходит ошибка от SDK: status 429, а подробности — в errorDetails
    expect(isRetryableModelError({ status: 429, message: 'Too Many Requests' })).toBe(true)
    expect(isRetryableModelError({ status: 'RESOURCE_EXHAUSTED' })).toBe(true)
    expect(
      isRetryableModelError({
        message: 'generic error',
        errorDetails: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure' }],
      })
    ).toBe(true)
  })

  it('узнаёт перегрузку модели', () => {
    expect(isRetryableModelError(new Error('This model is currently experiencing high demand'))).toBe(true)
    expect(isRetryableModelError(new Error('503 Service Unavailable'))).toBe(true)
  })

  it('не путает обычные ошибки с исчерпанием квоты', () => {
    expect(isRetryableModelError(new Error('Invalid argument'))).toBe(false)
    expect(isRetryableModelError(new Error('Model returned an invalid payload'))).toBe(false)
  })
})
