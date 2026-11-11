import { XLSX } from '@/lib/xlsx'
import { PrismaClient, UniversityType } from '@prisma/client'

type RawRow = Record<string, unknown>

export interface UniversityImportError {
  row: number
  message: string
}

export interface UniversityImportSummary {
  dryRun: boolean
  totalRows: number
  processed: number
  created: number
  updated: number
  skipped: number
  errors: UniversityImportError[]
}

const FIELD_ALIASES = {
  name:        ['name', 'название', 'название вуза', 'наименование вуза', 'полное название', 'наименование', 'университет', 'вуз'],
  nameKz:      ['namekz', 'название на казахском', 'казахское название', 'атауы'],
  shortName:   ['shortname', 'аббревиатура', 'краткое название', 'short', 'код'],
  region:      ['region', 'регион', 'область', 'город', 'код региона'],
  address:     ['address', 'адрес'],
  website:     ['website', 'сайт', 'url', 'ссылка'],
  email:       ['email', 'почта', 'e-mail'],
  phone:       ['phone', 'телефон', 'тел'],
  rector:      ['rector', 'ректор', 'руководитель'],
  description: ['description', 'описание', 'аннотация'],
  type:        ['type', 'тип', 'вид', 'форма'],
} as const

const TYPE_MAP: Record<string, UniversityType> = {
  state:            UniversityType.STATE,
  'государственный': UniversityType.STATE,
  'гос':            UniversityType.STATE,
  private:          UniversityType.PRIVATE,
  'частный':        UniversityType.PRIVATE,
  national:         UniversityType.NATIONAL,
  'национальный':   UniversityType.NATIONAL,
  research:         UniversityType.RESEARCH,
  'исследовательский': UniversityType.RESEARCH,
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

function isEmptyRow(row: RawRow) {
  return Object.values(row).every(v => String(v ?? '').trim() === '')
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

function parseType(value: unknown): UniversityType {
  const n = normalize(value)
  const c = compact(value)
  return TYPE_MAP[n] || TYPE_MAP[c] || UniversityType.STATE
}

export function parseUniversityWorkbook(buffer: Buffer, maxRows = 0): RawRow[] {
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

export async function importUniversitiesFromRows(
  prisma: PrismaClient,
  rows: RawRow[],
  dryRun: boolean,
): Promise<UniversityImportSummary> {
  const summary: UniversityImportSummary = {
    dryRun,
    totalRows: rows.length,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  // Build region lookup: name, nameKz, code → id
  const regions = await prisma.region.findMany({
    select: { id: true, name: true, nameKz: true, code: true },
  })
  const regionIndex = new Map<string, string>()
  for (const r of regions) {
    regionIndex.set(normalize(r.name), r.id)
    regionIndex.set(normalize(r.code), r.id)
    if (r.nameKz) regionIndex.set(normalize(r.nameKz), r.id)

    // Города принимаем и с уточнением в скобках: в старых таблицах
    // встречается «Алматы (город)», «Шымкент (город)» — раньше регион
    // назывался так же, и файлы вузов делались по нему.
    if (r.code === 'ALA') regionIndex.set(normalize('Алматы (город)'), r.id)
    if (r.code === 'SHY') regionIndex.set(normalize('Шымкент (город)'), r.id)
    if (r.code === 'AST') regionIndex.set(normalize('Астана (город)'), r.id)
  }

  // Build existing university lookup by name + shortName
  const existing = await prisma.university.findMany({
    select: { id: true, name: true, shortName: true },
  })
  const universityIndex = new Map<string, string>()
  for (const u of existing) {
    universityIndex.set(normalize(u.name), u.id)
    if (u.shortName) universityIndex.set(normalize(u.shortName), u.id)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2

    if (isEmptyRow(row)) {
      summary.skipped++
      continue
    }

    const rowIndex = buildRowIndex(row)
    const name = text(getField(rowIndex, 'name'))

    if (!name) {
      summary.errors.push({ row: rowNumber, message: 'Нет названия вуза' })
      summary.skipped++
      continue
    }

    const regionRaw = getField(rowIndex, 'region')
    const regionId = regionRaw ? (regionIndex.get(normalize(regionRaw)) || null) : null

    if (!regionId) {
      summary.errors.push({ row: rowNumber, message: `Регион не найден: «${regionRaw || '—'}»` })
      summary.skipped++
      continue
    }

    const data = {
      name,
      nameKz:      text(getField(rowIndex, 'nameKz')),
      shortName:   text(getField(rowIndex, 'shortName')),
      regionId,
      address:     text(getField(rowIndex, 'address')),
      website:     text(getField(rowIndex, 'website')),
      email:       text(getField(rowIndex, 'email')),
      phone:       text(getField(rowIndex, 'phone')),
      rector:      text(getField(rowIndex, 'rector')),
      description: text(getField(rowIndex, 'description')),
      type:        parseType(getField(rowIndex, 'type')),
    }

    summary.processed++

    const existingId =
      universityIndex.get(normalize(name)) ||
      (data.shortName ? universityIndex.get(normalize(data.shortName)) : undefined)

    if (dryRun) {
      if (existingId) summary.updated++
      else summary.created++
      continue
    }

    if (existingId) {
      await prisma.university.update({ where: { id: existingId }, data })
      summary.updated++
    } else {
      const created = await prisma.university.create({ data, select: { id: true } })
      universityIndex.set(normalize(name), created.id)
      if (data.shortName) universityIndex.set(normalize(data.shortName), created.id)
      summary.created++
    }
  }

  summary.errors = summary.errors.slice(0, 100)
  return summary
}
