import { describe, expect, it } from 'vitest'
import { isDescriptionEmpty, publicationBlocker } from '@/lib/project-completeness'

const FULL = 'Чат-бот приёмной комиссии отвечает абитуриентам на вопросы о поступлении.'

describe('isDescriptionEmpty', () => {
  it('пустое, короткое и заглушка импорта считаются пустыми', () => {
    expect(isDescriptionEmpty(null)).toBe(true)
    expect(isDescriptionEmpty('')).toBe(true)
    expect(isDescriptionEmpty('Ии')).toBe(true)
    expect(isDescriptionEmpty('Запущен.')).toBe(true)
    expect(isDescriptionEmpty('Описание не указано')).toBe(true)
    expect(isDescriptionEmpty('  описание   не указано  ')).toBe(true)
  })

  it('пробелы не помогают набрать длину', () => {
    expect(isDescriptionEmpty('Ии' + ' '.repeat(40))).toBe(true)
  })

  it('содержательное описание не пустое, в том числе казахское', () => {
    expect(isDescriptionEmpty(FULL)).toBe(false)
    expect(isDescriptionEmpty('Талапкерлерге арналған жасанды интеллект көмекшісі')).toBe(false)
  })
})

describe('publicationBlocker', () => {
  it('карточку без описания не пускает никого', () => {
    expect(publicationBlocker({ description: 'Ии', status: 'IDEA' }, { requireImplementedAt: false })).toMatch(/описание/)
    expect(publicationBlocker({ description: 'Ии', status: 'IDEA' }, { requireImplementedAt: true })).toMatch(/описание/)
  })

  it('«внедрено» без места внедрения блокирует только вуз', () => {
    const project = { description: FULL, status: 'IMPLEMENTED', implementedAt: '  ' }
    expect(publicationBlocker(project, { requireImplementedAt: true })).toMatch(/где внедрено/)
    expect(publicationBlocker(project, { requireImplementedAt: false })).toBeNull()
  })

  it('«масштабировано» проверяется так же, как «внедрено»', () => {
    expect(publicationBlocker({ description: FULL, status: 'SCALED' }, { requireImplementedAt: true })).not.toBeNull()
  })

  it('идее, прототипу и пилоту место внедрения не нужно', () => {
    for (const status of ['IDEA', 'PROTOTYPE', 'PILOT']) {
      expect(publicationBlocker({ description: FULL, status }, { requireImplementedAt: true })).toBeNull()
    }
  })

  it('заполненная внедрённая карточка проходит', () => {
    expect(publicationBlocker(
      { description: FULL, status: 'IMPLEMENTED', implementedAt: 'Приёмная комиссия университета' },
      { requireImplementedAt: true },
    )).toBeNull()
  })
})
