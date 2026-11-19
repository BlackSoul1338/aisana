import { describe, expect, it } from 'vitest'
import { FIELD_ORDER, scoreFields, type FieldStatus, type NeedFieldKey, type RawField } from './readiness'
import { normalize, quoteFound, verifyAnalysis, type AiAnalysis } from './quotes'
import { QUICK_REPLIES, selectQuestions } from './questions'
import { fieldChanges } from './diff'
import { findSensitive, isValidIbanKz, isValidIin, luhn } from './sensitive'
import { MATCH_MIN_SCORE, needQuery } from './match'
import { indexProject, searchIndex } from '@/lib/search/engine'
import { needSummary } from './summary'

const raw = (statuses: Partial<Record<NeedFieldKey, FieldStatus>>): RawField[] =>
  FIELD_ORDER.map(key => ({ key, status: statuses[key] ?? 'missing', value: 'x', quote: 'x', quoteVerified: true }))

const ALL_OK = Object.fromEntries(FIELD_ORDER.map(key => [key, 'ok'])) as Record<NeedFieldKey, FieldStatus>

describe('полнота описания потребности', () => {
  it('ok — полный вес, weak — половина, missing — ноль; сумма весов 100', () => {
    expect(scoreFields(raw(ALL_OK)).readiness).toBe(100)
    expect(scoreFields(raw({})).readiness).toBe(0)
    expect(scoreFields(raw({ data: 'weak', task: 'ok', scale: 'ok' })).readiness).toBe(10 + 20 + 10)
  })

  it('поле, которого нет в ответе, считается незаполненным', () => {
    const { fields } = scoreFields([])
    expect(fields.map(f => f.status)).toEqual(FIELD_ORDER.map(() => 'missing'))
  })
})

describe('проверка цитат', () => {
  it('нормализация: регистр, ё, кавычки, пробелы, пунктуация по краям', () => {
    expect(normalize('  «Ёлка»   Растёт. ')).toBe('елка растет')
  })

  it('цитата ищется в репликах компании, допускаются фрагменты через многоточие', () => {
    const corpus = 'Мы горнодобывающая компания. Есть архив видео с камер на конвейере за год.'
    expect(quoteFound('архив видео с камер', corpus)).toBe(true)
    expect(quoteFound('горнодобывающая … за год', corpus)).toBe(true)
    expect(quoteFound('данные из SAP', corpus)).toBe(false)
    expect(quoteFound('да', corpus)).toBe(false) // короче трёх символов — не цитата
    expect(quoteFound('', corpus)).toBe(false)
  })

  it('поле без подтверждённой цитаты становится missing — за компанию ничего не придумывается', () => {
    const field = (status: FieldStatus, quote: string) => ({ status, value: 'v', quote })
    const ai: AiAnalysis = {
      task: field('ok', 'контроль качества сварных швов'),
      problem: field('weak', 'проверяют вручную'),
      goal: field('ok', 'Какого результата вы ждёте?'), // цитата из вопроса ассистента
      data: field('ok', 'есть фото швов'),
      environment: field('missing', ''),
      integrations: field('ok', 'интеграция с SAP'), // в репликах этого нет
      scale: field('missing', ''),
      questions: [],
    }
    const result = verifyAnalysis(ai, ['Нужен контроль качества сварных швов. Сейчас проверяют вручную, есть фото швов.'])
    const byKey = Object.fromEntries(result.map(f => [f.key, f.status]))
    expect(byKey).toEqual({
      task: 'ok', problem: 'weak', goal: 'missing', data: 'ok', environment: 'missing', integrations: 'missing', scale: 'missing',
    })
  })

  it('готовые ответы-кнопки можно подтвердить цитатой, в отличие от короткого «да»', () => {
    for (const reply of Object.values(QUICK_REPLIES.ru).flat()) {
      expect(quoteFound(reply.slice(0, 40), `Ассистент спросил, мы ответили: ${reply}`)).toBe(true)
    }
  })
})

describe('выбор вопросов', () => {
  it('первый ход: не меньше трёх, самые весомые пробелы первыми, текст модели сохраняется', () => {
    const { fields } = scoreFields(raw({ task: 'ok', problem: 'ok', goal: 'weak' }))
    const questions = selectQuestions({
      fields, aiQuestions: [{ field: 'data', text: 'Какие фото или видео вы можете передать?' }], turn: 1,
    })
    expect(questions.length).toBeGreaterThanOrEqual(3)
    expect(questions[0]).toEqual({ field: 'data', text: 'Какие фото или видео вы можете передать?' })
  })

  it('первый ход при полном описании — всё равно три уточняющих вопроса', () => {
    expect(selectQuestions({ fields: scoreFields(raw(ALL_OK)).fields, aiQuestions: [], turn: 1 })).toHaveLength(3)
  })

  it('следующие ходы: не больше трёх и только по пробелам', () => {
    expect(selectQuestions({ fields: scoreFields(raw({ task: 'ok' })).fields, aiQuestions: [], turn: 2 })).toHaveLength(3)
    expect(selectQuestions({ fields: scoreFields(raw(ALL_OK)).fields, aiQuestions: [], turn: 3 })).toEqual([])
  })
})

describe('персональные данные', () => {
  it('находит ИИН с контрольной цифрой, карту по Луну, телефон и email, фрагменты маскирует', () => {
    expect(isValidIin('900101300453')).toBe(true)
    expect(isValidIin('900101300454')).toBe(false)
    expect(isValidIin('901301300453')).toBe(false) // 13-й месяц
    expect(luhn('4111111111111111')).toBe(true)
    const found = findSensitive('Пишите ivan.petrov@corp.kz или +7 (701) 123-45-67, ИИН 851231400676, карта 4111 1111 1111 1111')
    expect(found.map(f => f.kind).sort()).toEqual(['card', 'email', 'iin', 'phone'])
    expect(found.every(f => !f.excerpt.includes('123-45'))).toBe(true)
  })

  it('ловит адрес почты без точки в домене — такие учётки есть в базе', () => {
    expect(findSensitive('Пишите на ivan@intranet').map(f => f.kind)).toEqual(['email'])
    expect(findSensitive('Почта: ivan@corp.kz, конец.').map(f => f.kind)).toEqual(['email'])
  })

  it('БИН компании с верной контрольной цифрой не считается ИИН: компания может его назвать', () => {
    // В 5–6 разрядах БИН — тип юрлица (4–6) и признак, а не день рождения
    for (const bin of ['040340001233', '150540012348', '991240005679']) {
      expect(findSensitive(`Наш БИН ${bin}`)).toEqual([])
    }
  })

  it('бюджеты, артикулы и случайные длинные числа не считаются персональными данными', () => {
    expect(findSensitive('Бюджет 150000000000 тенге, артикул 123456789012, заказ 4111111111111112')).toEqual([])
    expect(findSensitive('Бюджет 1 500 000 000 000 тенге')).toEqual([])
  })

  it('находит ИИН, записанный с разделителями, и IBAN Казахстана по mod-97-10', () => {
    expect(isValidIbanKz('KZ86125KZT5004100100')).toBe(true)
    expect(isValidIbanKz('KZ86125KZT5004100101')).toBe(false)
    expect(findSensitive('ИИН 851231 4006 76').map(f => f.kind)).toEqual(['iin'])
    expect(findSensitive('и и н: 851231-4006-76').map(f => f.kind)).toEqual(['iin'])
    expect(findSensitive('Реквизиты: KZ86125KZT5004100100 — казначейство').map(f => f.kind)).toEqual(['iban'])
    expect(findSensitive('IBAN KZ86 125K ZT50 0410 0100').map(f => f.kind)).toEqual(['iban'])
    expect(findSensitive('IBAN KZ86 125K ZT50 0410 0101')).toEqual([])
  })
})

describe('изменения за ход', () => {
  it('показывает, какое поле и насколько подняла ответ компании', () => {
    const before = scoreFields(raw({ task: 'ok' })).fields
    const after = scoreFields(raw({ task: 'ok', data: 'ok', goal: 'weak' })).fields
    expect(fieldChanges(before, after)).toEqual([
      { field: 'goal', from: 'missing', to: 'weak', delta: 7.5 },
      { field: 'data', from: 'missing', to: 'ok', delta: 20 },
    ])
    expect(fieldChanges(null, after)).toEqual([])
  })
})

describe('запрос к поиску по потребности', () => {
  it('ищет по подтверждённым задаче, проблеме и результату, а не по контуру и масштабу', () => {
    const fields = scoreFields([
      { key: 'task', status: 'ok', value: 'контроль сварных швов', quote: 'q', quoteVerified: true },
      { key: 'goal', status: 'weak', value: 'меньше брака', quote: 'q', quoteVerified: true },
      { key: 'environment', status: 'ok', value: 'закрытый контур', quote: 'q', quoteVerified: true },
    ]).fields
    expect(needQuery(fields, ['что-то другое'])).toBe('контроль сварных швов. меньше брака')
  })

  it('пока поля не заполнены — ищет по репликам компании', () => {
    expect(needQuery(scoreFields([]).fields, ['Нужен прогноз спроса', 'для кофеен'])).toBe('Нужен прогноз спроса для кофеен')
  })
})

describe('сводка для оператора', () => {
  it('в сводку попадают только подтверждённые значения и комментарий компании', () => {
    const fields = scoreFields([
      { key: 'task', status: 'ok', value: 'контроль сварных швов', quote: 'q', quoteVerified: true },
      { key: 'data', status: 'weak', value: 'фото', quote: 'q', quoteVerified: true },
    ]).fields
    const text = needSummary(fields, 30, '  Позвоните после обеда ')
    expect(text).toContain('Задача и процесс: контроль сварных швов')
    expect(text).toContain('Доступные данные: фото (без подробностей)')
    expect(text).toContain('Интеграции: не указано')
    expect(text).toContain('Полнота описания: 30%.')
    expect(text).toContain('Комментарий компании: Позвоните после обеда')
  })
})

describe('подборка по потребности', () => {
  // Две задачи из выборки Sana (data/business-tasks.json): одна с решением в каталоге, другая без
  const index = [
    { id: 'health', title: 'Система раннего выявления заболеваний по снимкам', category: 'SCIENCE', tags: ['медицина', 'диагностика заболеваний'],
      description: 'Нейросеть анализирует рентгеновские снимки и выделяет признаки патологии, формирует предварительное заключение для врача.' },
    { id: 'mining', title: 'Предиктивная диагностика горного оборудования', category: 'ANALYTICS', tags: ['горнодобывающая промышленность'],
      description: 'Модель по данным вибрации и температуры прогнозирует отказы конвейеров и дробилок. Раньше осмотр вели вручную, по опыту механика, каждый вечер.' },
  ].map(p => indexProject(p as any))
  const match = (query: string) => searchIndex(index, query, { minScore: MATCH_MIN_SCORE }).hits.map(h => h.id)

  it('задача с решением в каталоге находит его', () => {
    expect(match('Распознавание рентгеновских снимков: врачи вручную ищут признаки патологии')[0]).toBe('health')
  })

  it('порог отсекает случайные совпадения: для кофеен решений нет', () => {
    expect(match('12 кофеен заказывают выпечку у поставщика вручную каждый вечер по опыту управляющего. Сократить списания выпечки без потери продаж.')).toEqual([])
  })
})
