import { FIELD_TITLES, FIELD_WEIGHTS, STATUS_FACTOR, type FieldState, type NeedFieldKey } from './readiness'

export type Question = { field: NeedFieldKey; text: string }

/** Запасные формулировки, если модель не дала вопрос к полю. */
export const FALLBACK_QUESTIONS: Record<NeedFieldKey, { missing: string; weak: string; refine: string }> = {
  task: {
    missing: 'Какой процесс в компании вы хотите улучшить с помощью ИИ?',
    weak: 'Уточните, на каком шаге процесса нужно решение и кто в нём участвует?',
    refine: 'Есть ли смежные процессы, где решение тоже пригодится?',
  },
  problem: {
    missing: 'Что сейчас не устраивает в этом процессе: потери, ошибки, долгие сроки?',
    weak: 'Во что обходится проблема сейчас — время, деньги, брак?',
    refine: 'Пробовали ли вы уже решать эту проблему и что не получилось?',
  },
  goal: {
    missing: 'Какого результата вы ждёте от решения?',
    weak: 'Как вы поймёте, что решение работает: какой показатель и насколько должен измениться?',
    refine: 'Есть ли второстепенные цели, кроме основной?',
  },
  data: {
    missing: 'Какие данные у вас есть для решения: фото, видео, таблицы, тексты, показания датчиков?',
    weak: 'Уточните формат и объём данных и можно ли передать их разработчику?',
    refine: 'Нужно ли обезличить данные перед передачей разработчику?',
  },
  environment: {
    missing: 'Где должно работать решение: только в вашем контуре или облако допустимо?',
    weak: 'Есть ли требования информационной безопасности к размещению решения?',
    refine: 'Есть ли у вас своя инфраструктура для запуска решения — серверы, видеокарты?',
  },
  integrations: {
    missing: 'С какими системами должно работать решение: 1С, ERP, CRM, камеры, оборудование?',
    weak: 'Уточните, какие именно системы и как решение должно с ними обмениваться данными?',
    refine: 'Нужен ли доступ к решению через API для ваших программистов?',
  },
  scale: {
    missing: 'Каков масштаб: пилот на одном участке или сразу вся компания? В какие сроки?',
    weak: 'Уточните сроки и сколько подразделений или объектов охватит решение?',
    refine: 'Есть ли бюджет или срок, к которому нужно уложиться?',
  },
}

/**
 * Готовые ответы, которые компания может вставить одной кнопкой.
 * Это полные предложения: короткое «да» нельзя подтвердить цитатой,
 * а такое предложение — можно.
 */
export const QUICK_REPLIES: Partial<Record<NeedFieldKey, string[]>> = {
  environment: [
    'Решение должно работать только в нашем закрытом контуре, без облака.',
    'Облачное размещение для нас допустимо.',
  ],
  data: [
    'У нас есть архив фото и видео с производства.',
    'У нас есть таблицы и выгрузки из учётной системы.',
  ],
  integrations: [
    'Нужна интеграция с 1С.',
    'Интеграции с другими системами не требуются.',
  ],
  scale: [
    'Начнём с пилота на одном участке.',
  ],
}

export const FIRST_ROUND_MIN = 3
export const NEXT_ROUND_MAX = 3

/**
 * Вопросы выбираются по потерянному весу поля (как в Sana): первым уходит
 * вопрос о самом весомом пробеле. Первый ход — не меньше трёх вопросов,
 * дальше — до трёх и только по пробелам.
 */
export function selectQuestions(input: { fields: FieldState[]; aiQuestions: Question[]; turn: number }): Question[] {
  const gaps = input.fields
    .filter(f => f.status !== 'ok')
    .map(f => ({ f, lost: FIELD_WEIGHTS[f.key] * (1 - STATUS_FACTOR[f.status]) }))
    .sort((a, b) => b.lost - a.lost || FIELD_WEIGHTS[b.f.key] - FIELD_WEIGHTS[a.f.key])

  const textFor = (key: NeedFieldKey, kind: 'missing' | 'weak' | 'refine') => {
    const fromAi = input.aiQuestions.find(q => q.field === key)?.text.trim()
    return kind !== 'refine' && fromAi && fromAi.length >= 8 ? fromAi : FALLBACK_QUESTIONS[key][kind]
  }

  const out: Question[] = gaps.map(({ f }) => ({ field: f.key, text: textFor(f.key, f.status === 'weak' ? 'weak' : 'missing') }))

  if (input.turn === 1) {
    if (out.length < FIRST_ROUND_MIN) {
      const byWeight = input.fields.filter(f => f.status === 'ok').sort((a, b) => FIELD_WEIGHTS[b.key] - FIELD_WEIGHTS[a.key])
      for (const f of byWeight) {
        if (out.length >= FIRST_ROUND_MIN) break
        out.push({ field: f.key, text: textFor(f.key, 'refine') })
      }
    }
    return out.slice(0, Math.max(FIRST_ROUND_MIN, Math.min(out.length, 4)))
  }
  return out.slice(0, NEXT_ROUND_MAX)
}

/** Ответ ассистента собирает код, а не модель: в нём только выбранные вопросы. */
export const questionsMessage = (questions: Question[]) =>
  questions.length
    ? `Чтобы подобрать решение точнее, уточните, пожалуйста:\n${questions.map((q, i) => `${i + 1}. [${FIELD_TITLES[q.field]}] ${q.text}`).join('\n')}`
    : 'Сведений достаточно. Посмотрите подборку справа и отправьте запрос оператору.'
