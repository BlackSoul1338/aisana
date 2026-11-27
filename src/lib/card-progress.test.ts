import { describe, expect, it } from 'vitest'
import { cardProgress } from '@/lib/card-progress'
import { cardChecklist, type ChecklistInput } from '@/lib/card-checklist'

const LONG = 'Чат-бот отвечает абитуриентам на вопросы о поступлении, грантах и документах круглосуточно на казахском и русском языках. '.repeat(2)
const FULL: ChecklistInput = {
  description: LONG, impact: 'Сократили время ответа', results: 'Запущен', leadName: 'Иванов',
  status: 'PILOT', agentPassportPdf: '/p.pdf', files: [{ type: 'LINK', url: 'https://bot.example.kz' }],
}

describe('процент заполнения карточки', () => {
  it('пустая карточка — 0 %', () => {
    expect(cardProgress({})).toBe(0)
    expect(cardProgress({ description: 'Описание не указано, будет добавлено позже вузом.' })).toBe(0)
  })

  it('полная карточка — 100 %', () => {
    expect(cardProgress(FULL)).toBe(100)
  })

  it('без документа и без демо теряются обе проверки, а не одна', () => {
    // cardChecklist в этом случае выдаёт один пункт «documents» — по списку процент вышел бы завышенным
    const noEvidence = { ...FULL, agentPassportPdf: null, files: [] }
    expect(cardProgress(noEvidence)).toBe(Math.round(5 / 7 * 100))
  })

  it('«где внедрено» считается только для внедрённых и масштабированных', () => {
    expect(cardProgress({ ...FULL, status: 'PILOT', implementedAt: '' })).toBe(100)
    expect(cardProgress({ ...FULL, status: 'IMPLEMENTED', implementedAt: '' })).toBe(Math.round(7 / 8 * 100))
    expect(cardProgress({ ...FULL, status: 'SCALED', implementedAt: 'Приёмная комиссия' })).toBe(100)
  })

  it('короткое описание засчитывается наполовину: есть, но не 200 знаков', () => {
    expect(cardProgress({ ...FULL, description: 'Чат-бот для абитуриентов вуза' })).toBe(Math.round(6 / 7 * 100))
  })

  it('100 % ровно тогда, когда чек-листу нечего добавить', () => {
    const samples: ChecklistInput[] = [
      FULL,
      { ...FULL, leadName: '' },
      { ...FULL, impact: null },
      { ...FULL, files: [] },
      { ...FULL, agentPassportPdf: null },
      { ...FULL, status: 'IMPLEMENTED' },
      { ...FULL, status: 'IMPLEMENTED', implementedAt: 'Поликлиника' },
      { ...FULL, description: 'Коротко о проекте вуза' },
      { ...FULL, results: '', impact: '', leadName: '' },
    ]
    for (const sample of samples) {
      expect(cardProgress(sample) === 100).toBe(cardChecklist(sample).length === 0)
    }
  })
})
