import { describe, expect, it, vi } from 'vitest'

// project-import транзитивно импортирует auth.ts, где getCurrentUser обёрнут
// в React cache() (RSC). В node-окружении vitest cache не функция — подменяем
// на identity, чтобы модуль загрузился. Прод-код не меняется.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: (fn: unknown) => fn }
})

import { buildTechAliasMap } from '@/lib/project-import'

describe('buildTechAliasMap', () => {
  it('сводит известные алиасы к стабильным slug справочника', () => {
    const map = buildTechAliasMap()
    expect(map['gpt']?.slug).toBe('gen-ai')
    expect(map['ии']?.slug).toBe('gen-ai')
    expect(map['генеративный ии (llm)']?.slug).toBe('gen-ai')
    expect(map['cv']?.slug).toBe('computer-vision')
    expect(map['ocr']?.slug).toBe('computer-vision')
    expect(map['ml']?.slug).toBe('machine-learning')
    expect(map['chatbot']?.slug).toBe('chatbots')
    expect(map['faiss']?.slug).toBe('rag')
  })

  it('неизвестные технологии не подменяются и создаются как есть', () => {
    const map = buildTechAliasMap()
    expect(map['tesseract ocr']).toBeUndefined()
    expect(map['какая-то своя технология']).toBeUndefined()
  })
})