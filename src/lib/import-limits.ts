/**
 * Пределы импорта из Excel/CSV.
 *
 * Размер файла ограничен, чтобы arrayBuffer() не съедал память процесса,
 * число строк — чтобы одна загрузка не положила базу длинной транзакцией.
 */

/** Предел размера импортируемого файла — 10 МБ. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/** Предел числа строк за один импорт. */
export const MAX_IMPORT_ROWS = 1000

/**
 * Проверяет размер файла до чтения в память.
 *
 * Возвращает текст ошибки или null, если файл в порядке.
 */
export function checkImportSize(bytes: number): string | null {
  if (bytes <= MAX_IMPORT_BYTES) return null
  const limitMb = Math.round(MAX_IMPORT_BYTES / 1024 / 1024)
  return `Файл больше ${limitMb} МБ`
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
