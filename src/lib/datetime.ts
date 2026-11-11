/**
 * Форматирование дат и времени.
 *
 * Время в портале показывается по казахстанскому стандартному времени
 * (Asia/Qyzylorda, UTC+5). Сервер работает в UTC — без явной зоны браузер
 * показал бы время на 5 часов раньше местного.
 *
 * Зона задана константой, а не через TZ сервера: контейнер всё равно живёт
 * в UTC, а часовой пояс Казахстана не переводится на летнее время.
 */

/** Стандартный казахстанский часовой пояс (UTC+5, без перехода на летнее). */
export const TIME_ZONE = 'Asia/Qyzylorda'

/** Дата и время: «11.11.26, 15:00». */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString('ru-RU', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Дата: «11.11.2026». */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ru-RU', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Дата словами: «11 ноября 2026». */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ru-RU', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Дата в формате поля <input type="date">: «2026-11-11».
 *
 * Через toISOString() нельзя: это время UTC, и дата, сохранённая как
 * полночь по казахстанскому времени, уезжала на день назад.
 */
export function formatDateInput(date: Date | string | null | undefined): string {
  const value = date ? new Date(date) : new Date()
  if (Number.isNaN(value.getTime())) return ''
  return value.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}
