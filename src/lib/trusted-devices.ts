import crypto from 'crypto'

/**
 * Доверенные устройства для лимита попыток входа.
 *
 * Лимит по email защищает от перебора, но им же можно заблокировать чужую
 * учётку: пять неверных паролей — и владелец не войдёт 15 минут. Поэтому
 * браузер, из которого уже был успешный вход, получает cookie с токеном
 * устройства, и его попытки считаются в отдельной корзине. Злоумышленник
 * без пароля такую cookie не получит и блокирует только вход с новых
 * устройств.
 *
 * Токены живут в памяти процесса, как и счётчики rate-limit.ts: после
 * рестарта все устройства снова «новые» — это ухудшает только удобство,
 * а не защиту. Секрет и таблица в базе для этого не нужны.
 */

export const DEVICE_COOKIE = 'ai_map_kz_device'

/** Сколько помнить устройство — столько же, сколько живёт сессия. */
export const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const MAX_DEVICES = 50_000

type Device = { email: string; expiresAt: number }

const devices = new Map<string, Device>()

/** Устройство, с которого уже входили в эту учётку, и срок не истёк. */
export function isTrustedDevice(token: string | undefined, email: string): boolean {
  if (!token) return false
  const device = devices.get(token)
  if (!device) return false
  if (device.expiresAt <= Date.now()) {
    devices.delete(token)
    return false
  }
  return device.email === email
}

/**
 * Запоминает устройство после успешного входа и возвращает его токен.
 * Уже доверенное устройство сохраняет прежний токен, срок продлевается.
 */
export function trustDevice(token: string | undefined, email: string): string {
  const value = token && isTrustedDevice(token, email) ? token : crypto.randomBytes(32).toString('hex')
  devices.delete(value)
  devices.set(value, { email, expiresAt: Date.now() + DEVICE_MAX_AGE_SECONDS * 1000 })

  // Переполнение: выбрасываем самые давние записи (Map хранит порядок вставки)
  while (devices.size > MAX_DEVICES) {
    const oldest = devices.keys().next().value
    if (oldest === undefined) break
    devices.delete(oldest)
  }
  return value
}
