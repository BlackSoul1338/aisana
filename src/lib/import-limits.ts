/**
 * Пределы импорта из Excel/CSV.
 *
 * Размер ограничен, чтобы загрузка не съедала память процесса: formData()
 * читает тело целиком, а разбор книги раздувает файл в памяти во много раз.
 * Число строк — чтобы один импорт (запросы к базе идут построчно) не держал
 * запрос минутами.
 */

/** Предел размера импортируемого файла — 10 МБ. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/** Запас на поля формы и границы multipart сверх размера самого файла. */
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024

/** Предел числа строк за один импорт. */
export const MAX_IMPORT_ROWS = 5000

/**
 * Сколько строк листа разбирать: заголовок, предел и ещё одна строка —
 * чтобы заметить превышение, не разворачивая в память весь лист.
 */
export const IMPORT_SHEET_ROWS = MAX_IMPORT_ROWS + 2

function sizeMessage(): string {
  const limitMb = Math.round(MAX_IMPORT_BYTES / 1024 / 1024)
  return `Файл больше ${limitMb} МБ`
}

/**
 * Проверяет объявленный размер тела запроса — до formData(), который
 * прочитал бы тело в память целиком.
 *
 * Возвращает текст ошибки или null. Без заголовка Content-Length проверка
 * пропускается: тогда сработает проверка размера самого файла.
 */
export function checkImportRequestSize(contentLength: string | null): string | null {
  const declared = Number(contentLength)
  if (!contentLength || !Number.isFinite(declared)) return null
  return declared > MAX_IMPORT_BYTES + MULTIPART_OVERHEAD_BYTES ? sizeMessage() : null
}

/**
 * Проверяет размер файла до разбора.
 *
 * Возвращает текст ошибки или null, если файл в порядке.
 */
export function checkImportSize(bytes: number): string | null {
  return bytes <= MAX_IMPORT_BYTES ? null : sizeMessage()
}

/**
 * Проверяет число строк после разбора файла.
 *
 * Возвращает текст ошибки или null, если строк не больше лимита.
 */
export function checkImportRows(rows: number): string | null {
  if (rows <= MAX_IMPORT_ROWS) return null
  return `В файле больше ${MAX_IMPORT_ROWS} строк — разбейте его на части`
}
