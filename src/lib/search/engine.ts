/**
 * Поисковый движок портала.
 *
 * Ранжирование складывается из двух независимых сигналов:
 *
 *  1. Смысловой — совпадение направлений запроса с направлениями проекта.
 *     Именно он находит «нейросеть для обнаружения дефектов сварки»
 *     по запросу «промышленность», хотя такого слова в тексте нет.
 *
 *  2. Лексический — совпадение слов запроса с текстом проекта по всем полям
 *     сразу, с учётом словоформ и опечаток.
 *
 * Каждый результат несёт разбор: сколько дал каждый сигнал, какие поля
 * сработали и почему проект попал в выдачу (режим отладки).
 *
 * Отдельно от оценки решается, попадает ли проект в выдачу вообще
 * (см. «Отбор» в scoreProject). Раньше хватало любого ненулевого сигнала,
 * и запрос «абитуриент» возвращал три четверти портала: слово относится
 * к направлению «Образование», а к нему отнесено большинство проектов.
 */

import { classifyProject, type ClassifiableProject, type TopicMatch } from './classify'
import { parseQuery, type ParsedQuery } from './query'
import { fuzzyMatches, hasAllWords, normalize, tokenize } from './text'
import type { TopicId } from './taxonomy'

/** Поля, по которым идёт лексический поиск, и их вклад в оценку. */
const SEARCH_FIELDS = {
  title: 5,
  tags: 3,
  technologies: 3,
  description: 2,
  impact: 1.2,
  results: 1.2,
  category: 1,
  status: 0.6,
  university: 0.6,
  region: 0.5,
  leadName: 0.4,
} as const

type SearchField = keyof typeof SEARCH_FIELDS

/**
 * Поля с содержанием проекта. Остальные — служебные (вуз, регион, стадия,
 * категория, руководитель): совпадение только в них не делает проект
 * ответом на запрос. «Казахский язык» иначе находил все проекты вузов,
 * в названии которых есть слово «Казахский».
 */
const CONTENT_FIELDS: ReadonlySet<SearchField> = new Set<SearchField>([
  'title', 'tags', 'technologies', 'description', 'impact', 'results',
])

/** Направление шире этой доли портала запрос не сужает и само в выдачу не приводит. */
const BROAD_TOPIC_SHARE = 0.3
/** Проект приходит в выдачу по одному направлению, только если уверенно к нему отнесён. */
const MIN_TOPIC_SCORE = 40
/** …и только если запрос прямо называет направление, а не задевает его одним словом. */
const MIN_TOPIC_INTENT = 0.9
/** Какая доля слов многословного запроса должна найтись в проекте. */
const MIN_COVERAGE = 0.6

const FIELD_LABELS: Record<SearchField, string> = {
  title: 'название',
  tags: 'теги',
  technologies: 'технологии',
  description: 'описание',
  impact: 'влияние',
  results: 'результаты',
  category: 'категория',
  status: 'статус',
  university: 'вуз',
  region: 'регион',
  leadName: 'руководитель',
}

export interface IndexableProject extends ClassifiableProject {
  id: string
  status?: string | null
  isBestPractice?: boolean | null
  leadName?: string | null
  university?: { name?: string | null; shortName?: string | null; region?: { name?: string | null } | null } | null
}

export interface IndexedProject {
  id: string
  topics: TopicMatch[]
  topicScore: Map<TopicId, number>
  fields: Record<SearchField, { text: string; tokens: string[] }>
  /** Сокращение вуза («КБТУ», «AITU») — по нему ищут все проекты вуза */
  universityShort: string[]
  isBestPractice: boolean
}

export interface SearchHit {
  id: string
  /** Итоговая оценка 0–100 (может срезаться потолком — для показа) */
  score: number
  /**
   * Необработанная сумма сигналов. Именно по ней сортируется выдача:
   * score срезан 100, и при срезе несколько проектов выглядят одинаково,
   * а их реальный порядок по релевантности известен только здесь.
   */
  rank: number
  topics: TopicMatch[]
  debug: {
    /** Вклад смыслового сигнала */
    topicPoints: number
    /** Вклад лексического сигнала */
    lexicalPoints: number
    /** Доля слов запроса, найденных в проекте */
    coverage: number
    /** Какие поля сработали и с каким вкладом */
    matchedFields: { field: string; label: string; terms: string[]; points: number }[]
    /** Совпавшие направления */
    matchedTopics: { topic: TopicId; label: string; queryWeight: number; projectScore: number; points: number }[]
    /** Почему проект попал в результаты — человеческим языком */
    reason: string
  }
}

const CATEGORY_TEXT: Record<string, string> = {
  EDUCATION: 'образование обучение',
  SCIENCE: 'наука исследования',
  MANAGEMENT: 'управление менеджмент',
  ANALYTICS: 'аналитика данные',
  GENERATIVE_AI: 'генеративный ии llm',
  COMPUTER_VISION: 'компьютерное зрение изображения',
  ROBOTICS: 'робототехника роботы',
}

const STATUS_TEXT: Record<string, string> = {
  IDEA: 'идея концепция',
  PROTOTYPE: 'прототип',
  PILOT: 'пилот пилотный проект',
  IMPLEMENTED: 'внедрено внедрение',
  SCALED: 'масштабировано тиражирование',
}

/** Готовит проект к поиску: классифицирует и раскладывает текст по полям. */
export function indexProject(project: IndexableProject): IndexedProject {
  const topics = classifyProject(project)

  const raw: Record<SearchField, string> = {
    title: project.title ?? '',
    tags: (project.tags ?? []).join(' '),
    technologies: (project.technologies ?? []).map(t => t.name).join(' '),
    description: project.description ?? '',
    impact: project.impact ?? '',
    results: project.results ?? '',
    category: CATEGORY_TEXT[String(project.category ?? '')] ?? '',
    status: STATUS_TEXT[String(project.status ?? '')] ?? '',
    university: [project.university?.name, project.university?.shortName].filter(Boolean).join(' '),
    region: project.university?.region?.name ?? '',
    leadName: project.leadName ?? '',
  }

  const fields = {} as IndexedProject['fields']
  for (const field of Object.keys(SEARCH_FIELDS) as SearchField[]) {
    const text = normalize(raw[field])
    fields[field] = { text, tokens: tokenize(text) }
  }

  return {
    id: project.id,
    topics,
    topicScore: new Map(topics.map(t => [t.topic, t.score])),
    fields,
    universityShort: tokenize(normalize(project.university?.shortName ?? '')),
    isBestPractice: Boolean(project.isBestPractice),
  }
}

interface ScoreContext {
  /** Направления, к которым отнесена слишком большая доля портала */
  broadTopics: ReadonlySet<TopicId>
  /**
   * Строгий отбор. Нестрогий включается, когда строгий ничего не нашёл:
   * лучше показать частичные совпадения, чем пустую страницу.
   */
  strict: boolean
}

/** Оценивает один проиндексированный проект по разобранному запросу. */
function scoreProject(indexed: IndexedProject, query: ParsedQuery, context: ScoreContext): SearchHit | null {
  // ── Смысловой сигнал ──────────────────────────────────────
  let topicPoints = 0
  // Хватает ли одного направления, чтобы показать проект без совпадения слов
  let topicQualifies = false
  const matchedTopics: SearchHit['debug']['matchedTopics'] = []

  for (const intent of query.topics) {
    const projectScore = indexed.topicScore.get(intent.topic)
    if (!projectScore) continue
    // Широкое направление почти ничего не говорит о проекте: к «Образованию»
    // отнесено большинство. Оно лишь слегка поднимает проект среди найденных.
    const broad = context.broadTopics.has(intent.topic)
    const points = intent.weight * (projectScore / 100) * 70 * (broad ? 0.15 : 1)
    if (!broad && intent.weight >= MIN_TOPIC_INTENT && projectScore >= MIN_TOPIC_SCORE) topicQualifies = true
    topicPoints += points
    matchedTopics.push({
      topic: intent.topic,
      label: intent.label,
      queryWeight: Math.round(intent.weight * 100) / 100,
      projectScore,
      points: Math.round(points * 10) / 10,
    })
  }

  // ── Лексический сигнал ────────────────────────────────────
  let lexicalPoints = 0
  const matchedFields = new Map<SearchField, { terms: Set<string>; points: number }>()
  const foundQueryTokens = new Set<string>()

  for (const token of query.tokens) {
    for (const field of Object.keys(SEARCH_FIELDS) as SearchField[]) {
      const { tokens } = indexed.fields[field]
      if (!tokens.length) continue

      const hit = tokens.some(word => fuzzyMatches(word, token))
      if (!hit) continue

      const weight = SEARCH_FIELDS[field]
      lexicalPoints += weight
      foundQueryTokens.add(token)

      const entry = matchedFields.get(field) ?? { terms: new Set<string>(), points: 0 }
      entry.terms.add(token)
      entry.points += weight
      matchedFields.set(field, entry)
    }
  }

  // Точная фраза запроса в названии или описании — сильный сигнал.
  // Фразу собираем из значимых слов запроса: со стоп-словами («на», «для»)
  // она в тексте не встречается никогда и бонус не срабатывал.
  // Порядок слов не важен: «контроль качества» засчитывается и когда в тексте
  // «качества контроль». Формы слов должны совпадать — «качество контроля»
  // бонуса не даёт; другие формы слов учитывает по-словный сигнал выше
  // (fuzzyMatches).
  //
  // Расширение запроса признаками направлений (query.expanded) намеренно
  // НЕ применяется: смысловой сигнал выше уже находит проект по запросу
  // «производство» → «сварка», а перебор расширенных слов по всем полям
  // замедлял поиск в 20 раз (21 мс → 544 мс на 1000 проектов).
  if (query.tokens.length > 1) {
    if (hasAllWords(indexed.fields.title.text, query.tokens)) lexicalPoints += 8
    else if (hasAllWords(indexed.fields.description.text, query.tokens)) lexicalPoints += 4
  }

  const coverage = query.tokens.length ? foundQueryTokens.size / query.tokens.length : 0

  // ── Отбор: попадает ли проект в выдачу ─────────────────────
  if (context.strict) {
    const contentMatch = [...matchedFields.keys()].some(field => CONTENT_FIELDS.has(field))
    // Многословный запрос: одного слова из двух мало. «Подготовка к ЕНТ»
    // иначе находил всё, где есть слово «подготовка».
    const required = Math.ceil(query.tokens.length * MIN_COVERAGE)
    const lexicalQualifies = contentMatch && foundQueryTokens.size >= required
    // Запрос — сокращение вуза: показываем его проекты, хотя в тексте его нет
    const universityQualifies = query.tokens.length > 0
      && query.tokens.every(token => indexed.universityShort.includes(token))
    if (!lexicalQualifies && !topicQualifies && !universityQualifies) return null
  }

  // Полное покрытие запроса словами проекта — заметная надбавка,
  // иначе длинные запросы теряются среди частичных совпадений
  if (coverage === 1 && query.tokens.length > 1) lexicalPoints *= 1.25

  const rawScore = topicPoints + lexicalPoints
  // Порог отсекает шум, но не должен убивать совпадения по «лёгким» полям
  // (регион, вуз, руководитель): их вклад 0.4–0.6, а порог был 3.
  if (rawScore < 0.4) return null

  // Лучшие практики чуть выше при прочих равных. Бонус применяем к
  // необработанному баллу, а не к округлённому: при 99 он давал +3
  // и превращал честное 99 в 100 — ложную ничью с настоящим 100.
  const rank = rawScore * (indexed.isBestPractice ? 1.03 : 1)
  const score = Math.min(100, Math.round(rank))

  const fieldsDebug = [...matchedFields.entries()]
    .map(([field, entry]) => ({
      field,
      label: FIELD_LABELS[field],
      terms: [...entry.terms],
      points: Math.round(entry.points * 10) / 10,
    }))
    .sort((a, b) => b.points - a.points)

  return {
    id: indexed.id,
    score,
    rank,
    topics: indexed.topics,
    debug: {
      topicPoints: Math.round(topicPoints * 10) / 10,
      lexicalPoints: Math.round(lexicalPoints * 10) / 10,
      coverage: Math.round(coverage * 100) / 100,
      matchedFields: fieldsDebug,
      matchedTopics: matchedTopics.sort((a, b) => b.points - a.points),
      reason: buildReason(matchedTopics, fieldsDebug),
    },
  }
}

function buildReason(
  topics: SearchHit['debug']['matchedTopics'],
  fields: SearchHit['debug']['matchedFields'],
): string {
  const parts: string[] = []

  if (topics.length) {
    const list = topics.slice(0, 3).map(t => `${t.label} (${t.projectScore})`).join(', ')
    parts.push(`совпали направления: ${list}`)
  }
  if (fields.length) {
    const list = fields.slice(0, 3)
      .map(f => `${f.label} — ${f.terms.map(t => `«${t}»`).join(', ')}`)
      .join('; ')
    parts.push(`слова запроса найдены: ${list}`)
  }

  return parts.length ? parts.join('; ') : 'слабое совпадение по тексту'
}

/**
 * Направления, к которым отнесена слишком большая доля проектов индекса.
 * Считается один раз на индекс: он кэшируется и пересобирается раз в минуту.
 */
const broadTopicsCache = new WeakMap<IndexedProject[], ReadonlySet<TopicId>>()

function broadTopicsOf(index: IndexedProject[]): ReadonlySet<TopicId> {
  const cached = broadTopicsCache.get(index)
  if (cached) return cached

  const counts = new Map<TopicId, number>()
  for (const item of index) {
    for (const topic of item.topicScore.keys()) counts.set(topic, (counts.get(topic) ?? 0) + 1)
  }
  const broad = new Set<TopicId>()
  // На маленьком индексе доля ничего не значит: два проекта из пяти — не «широкое»
  if (index.length >= 20) {
    for (const [topic, count] of counts) {
      if (count / index.length > BROAD_TOPIC_SHARE) broad.add(topic)
    }
  }
  broadTopicsCache.set(index, broad)
  return broad
}

export interface SearchOptions {
  limit?: number
  /** Порог оценки: ниже него результаты не показываются */
  minScore?: number
}

/** Ищет по подготовленному индексу и возвращает результаты по убыванию оценки. */
export function searchIndex(
  index: IndexedProject[],
  rawQuery: string,
  options: SearchOptions = {},
): { query: ParsedQuery; hits: SearchHit[] } {
  const query = parseQuery(rawQuery)
  const minScore = options.minScore ?? 0
  const limit = options.limit ?? 100

  const broadTopics = broadTopicsOf(index)
  const run = (strict: boolean) => index
    .map(item => scoreProject(item, query, { broadTopics, strict }))
    .filter((hit): hit is SearchHit => hit !== null && hit.score >= minScore)

  let found = run(true)
  // Строгий отбор ничего не дал — показываем частичные совпадения
  if (found.length === 0) found = run(false)

  const hits = found
    // Сортируем по необработанному баллу: score срезан 100, и при срезе
    // порядок «новые выше» не отражает релевантность.
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)

  return { query, hits }
}
