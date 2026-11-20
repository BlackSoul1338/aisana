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

/**
 * Имя локального PDF из ссылки на загрузку.
 *
 * Возвращает имя и для относительного `/uploads/имя.pdf`, и для полного
 * адреса портала — в базе встречаются оба вида. Для внешних ссылок без
 * `/uploads/` возвращает null: такие файлы нам не принадлежат.
 */
export function uploadFilename(url: unknown): string | null {
  const value = String(url ?? '').trim()
  if (!value) return null

  let pathname: string
  if (value.startsWith('/')) {
    pathname = value.split(/[?#]/)[0]
  } else {
    try {
      pathname = new URL(value).pathname
    } catch {
      return null
    }
  }

  const prefix = '/uploads/'
  if (!pathname.startsWith(prefix)) return null

  let name: string
  try {
    name = decodeURIComponent(pathname.slice(prefix.length))
  } catch {
    return null
  }

  if (!name || name.includes('/') || !name.toLowerCase().endsWith('.pdf')) return null
  return name
}

/**
 * Безопасный относительный путь для редиректа после логина (?next=...).
 * Принимает только безопасные относительные пути внутри сайта (/...).
 * Защищает от атак открытого перенаправления (open redirect).
 */
export function sanitizeNextPath(path?: string): string {
  if (!path || typeof path !== 'string') return '/admin'
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('//')) {
    return '/admin'
  }
  if (trimmed.includes('\\') || trimmed.includes('://') || /[\x00-\x1f]/.test(trimmed)) {
    return '/admin'
  }
  return trimmed
}

