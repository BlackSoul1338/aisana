import { describe, expect, it } from 'vitest'
import { getClientIp, isFirstInWindow, rateLimit, resetRateLimit } from './rate-limit'

describe('getClientIp', () => {
  it('берёт первое значение x-forwarded-for, как в upstream', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' }) }
    expect(getClientIp(req)).toBe('203.0.113.195')
  })

  it('использует x-real-ip при отсутствии x-forwarded-for', () => {
    const req = { headers: new Headers({ 'x-real-ip': '198.51.100.1' }) }
    expect(getClientIp(req)).toBe('198.51.100.1')
  })

  it('возвращает unknown при отсутствии заголовков или пустых значениях', () => {
    expect(getClientIp({ headers: new Headers() })).toBe('unknown')
    expect(getClientIp({ headers: new Headers({ 'x-forwarded-for': '   ' }) })).toBe('unknown')
  })

  it('пропускает пустые сегменты цепочки и доходит до x-real-ip', () => {
    const emptyFirst = {
      headers: new Headers({ 'x-forwarded-for': ', ', 'x-real-ip': '198.51.100.1' }),
    }
    expect(getClientIp(emptyFirst)).toBe('198.51.100.1')
  })

  it('очищает пробелы и управляющие символы', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '  192.168.1.1\r\n\t  ' }) }
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it('хеширует слишком длинные/поддельные заголовки, не раздувая ключи', () => {
    const longSpoofedHeader = '10.0.0.1' + 'A'.repeat(5000)
    const req = { headers: new Headers({ 'x-forwarded-for': longSpoofedHeader }) }
    const ip = getClientIp(req)
    expect(ip.length).toBe(32)
    expect(/^[0-9a-f]{32}$/.test(ip)).toBe(true)
  })
})

describe('eviction and memory protection', () => {
  it('дедупликация и flood не вытесняют корзины блокировки логина', () => {
    const lockoutKey = 'login:acc:victim@qazinn.kz'
    resetRateLimit(lockoutKey)

    // 1. Исчерпываем лимит попыток входа (блокировка)
    for (let i = 0; i < 5; i++) {
      rateLimit(lockoutKey, 5, 15 * 60 * 1000)
    }
    expect(rateLimit(lockoutKey, 5, 15 * 60 * 1000).ok).toBe(false)

    // 2. Длинные поддельные XFF не раздувают ключи
    for (let i = 0; i < 10; i++) {
      const spoofedLongHeader = `attacker-ip-${i}-` + 'X'.repeat(2000)
      const ip = getClientIp({ headers: new Headers({ 'x-forwarded-for': spoofedLongHeader }) })
      expect(ip.length).toBeLessThanOrEqual(64)
      expect(`login:ip:${ip}`.length).toBeLessThanOrEqual(80)
    }

    // 3. Атака вытеснения через dedup: отдельная таблица не трогает блокировку
    for (let i = 0; i < 55_000; i++) {
      isFirstInWindow(`view:user1:project-${i}`, 60 * 60 * 1000)
    }
    expect(rateLimit(lockoutKey, 5, 15 * 60 * 1000).ok).toBe(false)

    // 4. Flood rateLimit ключами со спуфленными IP: login:acc:* защищён
    for (let i = 0; i < 55_000; i++) {
      const spoofedIp = `198.51.100.${i % 250}-${i}`
      rateLimit(`login:ip:${spoofedIp}`, 20, 15 * 60 * 1000)
    }
    expect(rateLimit(lockoutKey, 5, 15 * 60 * 1000).ok).toBe(false)
  })
})