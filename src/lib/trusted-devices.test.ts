import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_MAX_AGE_SECONDS, isTrustedDevice, trustDevice } from '@/lib/trusted-devices'

const EMAIL = 'admin@mnvo.kz'

describe('доверенные устройства', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('без cookie устройство не доверенное', () => {
    expect(isTrustedDevice(undefined, EMAIL)).toBe(false)
    expect(isTrustedDevice('выдуманный-токен', EMAIL)).toBe(false)
  })

  it('после успешного входа устройство доверенное', () => {
    const token = trustDevice(undefined, EMAIL)
    expect(isTrustedDevice(token, EMAIL)).toBe(true)
  })

  it('токен привязан к учётке: для другой почты не действует', () => {
    const token = trustDevice(undefined, EMAIL)
    expect(isTrustedDevice(token, 'other@mnvo.kz')).toBe(false)
  })

  it('повторный вход с доверенного устройства сохраняет токен', () => {
    const token = trustDevice(undefined, EMAIL)
    expect(trustDevice(token, EMAIL)).toBe(token)
  })

  it('чужой или выдуманный токен заменяется новым', () => {
    const foreign = trustDevice(undefined, 'other@mnvo.kz')
    const issued = trustDevice(foreign, EMAIL)
    expect(issued).not.toBe(foreign)
    expect(isTrustedDevice(issued, EMAIL)).toBe(true)
  })

  it('устройство забывается по истечении срока', () => {
    vi.useFakeTimers()
    const token = trustDevice(undefined, EMAIL)
    vi.advanceTimersByTime(DEVICE_MAX_AGE_SECONDS * 1000 + 1)
    expect(isTrustedDevice(token, EMAIL)).toBe(false)
  })
})
