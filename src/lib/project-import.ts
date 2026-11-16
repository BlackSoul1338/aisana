import { XLSX } from '@/lib/xlsx'
import { PrismaClient, ProjectCategory, ProjectFileType, ProjectStatus, PublicationStatus, UserRole } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { canAccessUniversity } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { DESCRIPTION_PLACEHOLDER, isDescriptionEmpty } from '@/lib/project-completeness'
import { isAllowedFileUrl } from '@/lib/file-url'

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

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

    const description = text(getField(rowIndex, 'description')) || DESCRIPTION_PLACEHOLDER
    const technologyIds = await technologyConnect(splitList(getField(rowIndex, 'technologies')))
    const key = `${universityId}:${normalize(title)}`
    const existingProjectId = projectIndex.get(key)

    const data = {
      title,
      description,
      universityId,
      leadName: text(getField(rowIndex, 'leadName')),
      leadEmail: text(getField(rowIndex, 'leadEmail')),
      teamSize: numberOrNull(getField(rowIndex, 'teamSize')),
      launchDate: dateOrNull(getField(rowIndex, 'launchDate')),
      category: parseCategory(getField(rowIndex, 'category')),
      status: parseStatus(getField(rowIndex, 'status')),
      isBestPractice: bool(getField(rowIndex, 'isBestPractice')),
      isScalable: bool(getField(rowIndex, 'isScalable')),
      impact: text(getField(rowIndex, 'impact')),
      results: text(getField(rowIndex, 'results')),
      tags: splitList(getField(rowIndex, 'tags')),
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
        if (!exists) {
          await prisma.projectFile.create({
            data: { projectId, type: f.type, label: f.label, url: f.url },
          })
        }
      }
    }

    summary.processed += 1

    if (dryRun) {
      if (existingProjectId) summary.updated += 1
      else summary.created += 1
      continue
    }

    if (existingProjectId) {
      await prisma.project.update({
        where: { id: existingProjectId },
        data: {
          ...data,
          technologies: { set: technologyIds },
        },
      })
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
          publication: importerCanPublish && !isDescriptionEmpty(description) ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT,
          publishedAt: importerCanPublish && !isDescriptionEmpty(description) ? new Date() : null,
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
