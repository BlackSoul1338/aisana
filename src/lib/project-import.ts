import { XLSX } from '@/lib/xlsx'
import { PrismaClient, ProjectCategory, ProjectFileType, ProjectStatus, PublicationStatus, UserRole } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { canAccessUniversity } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { DESCRIPTION_PLACEHOLDER, isDescriptionEmpty } from '@/lib/project-completeness'
import { isAllowedFileUrl } from '@/lib/file-url'
import { canAttachUpload } from '@/lib/uploads'
import { TECHNOLOGY_LABELS } from '@/lib/technologies'

type RawRow = Record<string, unknown>

export interface ProjectImportError {
  row: number
  message: string
}

export interface ProjectImportSummary {
  dryRun: boolean
  totalRows: number
  processed: number
  created: number
  updated: number
  skipped: number
  errors: ProjectImportError[]
}

const FIELD_ALIASES = {
  title: ['title', 'project', 'название', 'название проекта', 'наименование проекта', 'проект'],
  description: ['description', 'описание', 'краткое описание', 'аннотация'],
  university: ['university', 'universityid', 'университет', 'вуз', 'id вуза', 'код вуза', 'название вуза'],
  leadName: ['leadname', 'руководитель', 'руководитель проекта', 'фио руководителя'],
  leadEmail: ['leademail', 'email', 'email руководителя', 'почта руководителя'],
  teamSize: ['teamsize', 'команда', 'размер команды', 'количество участников'],
  launchDate: ['launchdate', 'дата запуска', 'старт', 'дата старта'],
  category: ['category', 'категория', 'направление'],
  status: ['status', 'статус', 'этап'],
  technologies: ['technologies', 'technology', 'технологии', 'технология', 'стек'],
  tags: ['tags', 'теги', 'ключевые слова'],
  isBestPractice: ['isbestpractice', 'лучшая практика', 'best practice'],
  isScalable: ['isscalable', 'масштабируемый', 'готово к тиражированию', 'тиражирование'],
  impact: ['impact', 'эффект', 'влияние'],
  results: ['results', 'результаты', 'результат'],
  presentationPdf: ['presentationpdf', 'pdf', 'презентация pdf'],
  presentationPptx: ['presentationpptx', 'pptx', 'презентация pptx'],
  zoomLink: ['zoomlink', 'zoom', 'запись zoom'],
  videoUrl: ['videourl', 'video', 'видео'],
  documentation: ['documentation', 'документация', 'ссылка на документацию'],
} as const

const CATEGORY_MAP: Record<string, ProjectCategory> = {
  education: ProjectCategory.EDUCATION,
  'образование': ProjectCategory.EDUCATION,
  science: ProjectCategory.SCIENCE,
  'наука': ProjectCategory.SCIENCE,
  management: ProjectCategory.MANAGEMENT,
  'управление': ProjectCategory.MANAGEMENT,
  analytics: ProjectCategory.ANALYTICS,
  'аналитика': ProjectCategory.ANALYTICS,
  generative_ai: ProjectCategory.GENERATIVE_AI,
  'генеративный ии': ProjectCategory.GENERATIVE_AI,
  'генеративный ai': ProjectCategory.GENERATIVE_AI,
  computer_vision: ProjectCategory.COMPUTER_VISION,
  'компьютерное зрение': ProjectCategory.COMPUTER_VISION,
  robotics: ProjectCategory.ROBOTICS,
  'робототехника': ProjectCategory.ROBOTICS,
}

const STATUS_MAP: Record<string, ProjectStatus> = {
  idea: ProjectStatus.IDEA,
  'идея': ProjectStatus.IDEA,
  prototype: ProjectStatus.PROTOTYPE,
  'прототип': ProjectStatus.PROTOTYPE,
  pilot: ProjectStatus.PILOT,
  'пилот': ProjectStatus.PILOT,
  implemented: ProjectStatus.IMPLEMENTED,
  'внедрено': ProjectStatus.IMPLEMENTED,
  'реализовано': ProjectStatus.IMPLEMENTED,
  scaled: ProjectStatus.SCALED,
  'масштабировано': ProjectStatus.SCALED,
  'тиражировано': ProjectStatus.SCALED,
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function compact(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function text(value: unknown) {
  const result = String(value ?? '').trim()
  return result.length ? result : null
}

function teamSizeOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : null
}

function leadEmailOrNull(value: unknown) {
  const email = text(value)
  if (!email) return null
  return /^[^\s@]+@[^\s@]+$/.test(email) ? email : null
}

function bool(value: unknown) {
  const normalized = normalize(value)
  return ['1', 'true', 'yes', 'да', 'истина', 'y'].includes(normalized)
}

function dateOrNull(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d)
  }

  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function splitList(value: unknown) {
  return String(value ?? '')
    .split(/[;,|\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `tech-${Date.now()}`
}

function buildRowIndex(row: RawRow) {
  const result = new Map<string, unknown>()

  for (const [key, value] of Object.entries(row)) {
    result.set(normalize(key), value)
    result.set(compact(key), value)
  }

  return result
}

function getField(rowIndex: Map<string, unknown>, field: keyof typeof FIELD_ALIASES) {
  for (const alias of FIELD_ALIASES[field]) {
    const value = rowIndex.get(normalize(alias)) ?? rowIndex.get(compact(alias))
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }

  return null
}

/** Была ли колонка в файле вообще: пустая ячейка отличается от отсутствия. */
function hasField(rowIndex: Map<string, unknown>, field: keyof typeof FIELD_ALIASES) {
  return FIELD_ALIASES[field].some(alias =>
    rowIndex.has(normalize(alias)) || rowIndex.has(compact(alias)))
}

function parseCategory(value: unknown) {
  const normalized = normalize(value)
  const compacted = compact(value)
  return CATEGORY_MAP[normalized] || CATEGORY_MAP[compacted] || ProjectCategory.EDUCATION
}

function parseStatus(value: unknown) {
  const normalized = normalize(value)
  const compacted = compact(value)
  return STATUS_MAP[normalized] || STATUS_MAP[compacted] || ProjectStatus.IDEA
}

function isEmptyRow(row: RawRow) {
  return Object.values(row).every(value => String(value ?? '').trim() === '')
}

export function parseProjectWorkbook(buffer: Buffer, maxRows = 0) {
  // CSV: срезаем UTF-8 BOM (иначе он приклеивается к первому заголовку)
  // и читаем в UTF-8 (codepage 65001). Без этого кириллические заголовки
  // CSV без BOM декодировались неверно и все строки молча пропускались.
  const clean = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
    ? buffer.subarray(3)
    : buffer
  // maxRows (sheetRows) останавливает разбор на заданной строке: лист
  // в сотни тысяч строк не разворачивается в память целиком. 0 — без предела.
  const workbook = XLSX.read(clean, { type: 'buffer', cellDates: true, codepage: 65001, sheetRows: maxRows })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []

  return XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false,
  })
}

export async function importProjectsFromRows(
  prisma: PrismaClient,
  rows: RawRow[],
  user: AuthUser,
  dryRun: boolean,
): Promise<ProjectImportSummary> {
  // Модератор (админ/редактор) публикует импортированное сразу,
  // представитель вуза — только после проверки
  const importerCanPublish = canModerate(user)

  const summary: ProjectImportSummary = {
    dryRun,
    totalRows: rows.length,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  const universities = await prisma.university.findMany({
    select: { id: true, name: true, shortName: true },
  })
  const universityIndex = new Map<string, string>()

  for (const university of universities) {
    universityIndex.set(normalize(university.id), university.id)
    universityIndex.set(normalize(university.name), university.id)
    if (university.shortName) universityIndex.set(normalize(university.shortName), university.id)
  }

  const existingProjects = await prisma.project.findMany({
    select: { id: true, title: true, universityId: true },
  })
  const projectIndex = new Map(existingProjects.map(project => [
    `${project.universityId}:${normalize(project.title)}`,
    project.id,
  ]))

  const existingTechnologies = await prisma.technology.findMany({
    select: { id: true, slug: true },
  })
  const technologyIndex = new Map(existingTechnologies.map(technology => [technology.slug, technology.id]))

  async function resolveUniversityId(rawValue: unknown) {
    const hasRawValue = text(rawValue) !== null
    const resolved = universityIndex.get(normalize(rawValue))

    if (user.role === UserRole.UNIVERSITY_REP) {
      if (!user.universityId) return null
      if (hasRawValue && !resolved) return null
      if (resolved && resolved !== user.universityId) return null
      return user.universityId
    }

    return resolved || null
  }

  // ── Нормализация технологий ──────────────────────────────
  // Известные алиасы сводим к обобщённым группам (см. prisma/seed.ts),
  // чтобы импорт из Excel не плодил дубликаты вида AI / ИИ / GPT / Claude.
  // Неизвестные названия создаются как есть.
  const TECH_ALIASES: Record<string, { name: string; slug: string }> = (() => {
    const groups: [string, string, string[]][] = [
      ['Генеративный ИИ (LLM)', 'gen-ai',
        ['ai', 'ии', 'llm', 'gpt', 'chatgpt', 'claude', 'gemini', 'groq', 'llama', 'mistral', 'openai', 'edenai', 'генеративный ии', 'генеративный ии (llm)']],
      ['Машинное обучение', 'machine-learning',
        ['machine learning', 'ml', 'машинное обучение']],
      ['Компьютерное зрение', 'computer-vision',
        ['computer vision', 'cv', 'ocr', 'компьютерное зрение']],
      ['NLP', 'nlp', ['nlp']],
      ['RAG и векторный поиск', 'rag',
        ['rag', 'faiss', 'embeddings', 'rag и векторный поиск']],
      ['Чат-боты', 'chatbots',
        ['telegram', 'чат-бот', 'чат-боты', 'chatbot']],
      ['Другое', 'other',
        ['node', 'node.js', 'sqlite', 'streamlit', 'другое']],
    ]
    const map: Record<string, { name: string; slug: string }> = {}
    for (const [name, slug, aliases] of groups) {
      for (const alias of aliases) map[alias] = { name, slug }
    }
    // Выгрузка в kz-режиме содержит казахские подписи — принимаем их обратно,
    // иначе повторный импорт создаст дубликат технологии рядом с русской
    for (const [slug, label] of Object.entries(TECHNOLOGY_LABELS)) {
      for (const alias of [label.ru, label.kz]) {
        map[alias.trim().toLowerCase()] ??= { name: label.ru, slug }
      }
    }
    return map
  })()

  async function technologyConnect(names: string[]) {
    const uniqueNames = [...new Set(names)]
    const ids: string[] = []

    for (const rawName of uniqueNames) {
      const canonical = TECH_ALIASES[rawName.trim().toLowerCase()]
      const name = canonical?.name ?? rawName
      const slug = canonical?.slug ?? slugify(rawName)
      const cached = technologyIndex.get(slug)
      if (cached) {
        ids.push(cached)
        continue
      }

      if (dryRun) continue

      const technology = await prisma.technology.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      })
      technologyIndex.set(slug, technology.id)
      ids.push(technology.id)
    }

    return ids.map(id => ({ id }))
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const rowNumber = index + 2

    if (isEmptyRow(row)) {
      summary.skipped += 1
      continue
    }

    const rowIndex = buildRowIndex(row)
    const title = text(getField(rowIndex, 'title'))
    const universityId = await resolveUniversityId(getField(rowIndex, 'university'))

    if (!title) {
      summary.errors.push({ row: rowNumber, message: 'Нет названия проекта' })
      summary.skipped += 1
      continue
    }

    if (!universityId) {
      summary.errors.push({ row: rowNumber, message: 'Не найден или недоступен вуз' })
      summary.skipped += 1
      continue
    }

    if (!canAccessUniversity(user, universityId)) {
      summary.errors.push({ row: rowNumber, message: 'Недостаточно прав для этого вуза' })
      summary.skipped += 1
      continue
    }

    const teamSizeRaw = getField(rowIndex, 'teamSize')
    const teamSize = teamSizeOrNull(teamSizeRaw)
    if (hasField(rowIndex, 'teamSize') && teamSizeRaw !== null && teamSize === null) {
      summary.errors.push({ row: rowNumber, message: 'Команда: нужно целое число от 0 до 10000' })
      summary.skipped += 1
      continue
    }

    const leadEmailRaw = getField(rowIndex, 'leadEmail')
    const leadEmail = leadEmailOrNull(leadEmailRaw)
    if (hasField(rowIndex, 'leadEmail') && leadEmailRaw !== null && leadEmail === null) {
      summary.errors.push({ row: rowNumber, message: 'Некорректный email руководителя' })
      summary.skipped += 1
      continue
    }

    const description = text(getField(rowIndex, 'description'))
    const leadName = text(getField(rowIndex, 'leadName'))
    const launchDate = dateOrNull(getField(rowIndex, 'launchDate'))
    const impact = text(getField(rowIndex, 'impact'))
    const results = text(getField(rowIndex, 'results'))
    const tags = splitList(getField(rowIndex, 'tags'))
    const technologyIds = hasField(rowIndex, 'technologies')
      ? await technologyConnect(splitList(getField(rowIndex, 'technologies')))
      : []
    const key = `${universityId}:${normalize(title)}`
    const existingProjectId = projectIndex.get(key)

    const data = {
      title,
      description: description || DESCRIPTION_PLACEHOLDER,
      universityId,
      leadName,
      leadEmail,
      teamSize,
      launchDate,
      category: parseCategory(getField(rowIndex, 'category')),
      status: parseStatus(getField(rowIndex, 'status')),
      // Бейджи — публичная реклама проекта, их ставит только модератор.
      isBestPractice: importerCanPublish ? bool(getField(rowIndex, 'isBestPractice')) : false,
      isScalable: importerCanPublish ? bool(getField(rowIndex, 'isScalable')) : false,
      impact,
      results,
      tags,
    }

    // Ссылки из колонок кладём в project_files (вкладка «Файлы и ссылки»),
    // а не в легаси-поля проекта, которые нигде не отображаются
    const rowFiles = [
      { type: ProjectFileType.PRESENTATION,  label: 'Презентация (PDF)',  url: text(getField(rowIndex, 'presentationPdf')) },
      { type: ProjectFileType.PRESENTATION,  label: 'Презентация (PPTX)', url: text(getField(rowIndex, 'presentationPptx')) },
      { type: ProjectFileType.ZOOM,          label: 'Zoom запись',        url: text(getField(rowIndex, 'zoomLink')) },
      { type: ProjectFileType.VIDEO,         label: 'Видеодемонстрация',  url: text(getField(rowIndex, 'videoUrl')) },
      { type: ProjectFileType.DOCUMENTATION, label: 'Документация',       url: text(getField(rowIndex, 'documentation')) },
    ].filter((f): f is typeof f & { url: string } => Boolean(f.url) && isAllowedFileUrl(f.url))

    async function attachRowFiles(projectId: string) {
      for (const f of rowFiles) {
        const exists = await prisma.projectFile.findFirst({
          where: { projectId, url: f.url },
          select: { id: true },
        })
        if (exists) continue
        if (!(await canAttachUpload(user, f.url))) {
          summary.errors.push({ row: rowNumber, message: `Файл принадлежит другому проекту: ${f.label}` })
          continue
        }
        await prisma.projectFile.create({
          data: { projectId, type: f.type, label: f.label, url: f.url },
        })
      }
    }

    summary.processed += 1

    if (dryRun) {
      if (existingProjectId) summary.updated += 1
      else summary.created += 1
      continue
    }

    if (existingProjectId) {
      // Обновляем только те колонки, которые есть в файле: иначе частичная
      // таблица молча стирала бы описание, бейджи и остальные поля карточки.
      const updateData: Record<string, any> = { title, universityId }
      if (description) updateData.description = description
      if (leadName) updateData.leadName = leadName
      if (leadEmail) updateData.leadEmail = leadEmail
      if (teamSize !== null) updateData.teamSize = teamSize
      if (launchDate) updateData.launchDate = launchDate
      if (getField(rowIndex, 'category') !== null) updateData.category = parseCategory(getField(rowIndex, 'category'))
      if (getField(rowIndex, 'status') !== null) updateData.status = parseStatus(getField(rowIndex, 'status'))
      if (impact) updateData.impact = impact
      if (results) updateData.results = results
      if (tags.length) updateData.tags = tags
      if (technologyIds.length) updateData.technologies = { set: technologyIds }
      if (importerCanPublish && getField(rowIndex, 'isBestPractice') !== null) {
        updateData.isBestPractice = bool(getField(rowIndex, 'isBestPractice'))
      }
      if (importerCanPublish && getField(rowIndex, 'isScalable') !== null) {
        updateData.isScalable = bool(getField(rowIndex, 'isScalable'))
      }

      await prisma.project.update({ where: { id: existingProjectId }, data: updateData })
      await attachRowFiles(existingProjectId)
      summary.updated += 1
    } else {
      const project = await prisma.project.create({
        data: {
          ...data,
          // Импорт от представителя вуза попадает в черновики — как и ручное
          // добавление: на портал проект выходит после проверки модератором
          // Строка без описания остаётся черновиком даже у модератора: карточка
          // из одного названия на портал не выходит, пока её не заполнят
          publication: importerCanPublish && !isDescriptionEmpty(data.description) ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
          publishedAt: importerCanPublish && !isDescriptionEmpty(data.description) ? new Date() : null,
          technologies: technologyIds.length ? { connect: technologyIds } : undefined,
        },
        select: { id: true },
      })
      projectIndex.set(key, project.id)
      await attachRowFiles(project.id)
      summary.created += 1
    }
  }

  summary.errors = summary.errors.slice(0, 100)
  return summary
}
