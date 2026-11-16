/**
 * Допустимая ссылка на файл проекта.
 *
 * url рендерится как <a href> на публичной странице проекта, поэтому
 * javascript:-ссылка (и прочий мусор) в базе быть не должен. Проверка
 * одинаковая для ручного добавления и для импорта из Excel — иначе
 * импорт был бы обходом проверки.
 */
export function isAllowedFileUrl(url: unknown): boolean {
  const value = String(url ?? '').trim()
  if (!value) return false
  return /^https?:\/\//i.test(value) || value.startsWith('/uploads/')
}
