import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, formatDateInput, formatDateTime, TIME_ZONE } from '@/lib/datetime'

describe('форматирование дат по казахстанскому времени', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('время в журнале показывается на 5 часов позже серверного UTC', () => {
    // Сервер в UTC, портал показывает время по Asia/Qyzylorda (UTC+5).
    // Раньше время отставало на 5 часов.
    const utc = new Date('2026-11-11T10:00:00Z')
    const formatted = formatDateTime(utc)
    expect(formatted).toContain('15:00')
    expect(formatted).toContain('11.11.26')
  })

  it('дата не съезжает на день назад', () => {
    // Полночь по Казахстану = 19:00 предыдущего дня UTC.
    // toISOString() дал бы 10.11 вместо 11.11.
    const midnightAlmaty = new Date('2026-11-10T19:00:00Z')
    expect(formatDateInput(midnightAlmaty)).toBe('2026-11-11')
  })

  it('дата из формы (полночь UTC) остаётся тем же днём', () => {
    // Форма шлёт «2026-11-11», сервер сохраняет new Date('2026-11-11') —
    // полночь UTC. Так хранятся даты, введённые через формы.
    const fromForm = new Date('2026-11-11')
    expect(formatDateInput(fromForm)).toBe('2026-11-11')
    expect(formatDate(fromForm)).toBe('11.11.2026')
  })

  it('дата по умолчанию — сегодняшняя по Казахстану, а не по UTC', () => {
    // 01:00 11 ноября в Казахстане — это ещё 10 ноября по UTC.
    // toISOString() подставил бы в новое слушание вчерашнюю дату.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T20:00:00Z'))
    expect(formatDateInput(null)).toBe('2026-11-11')
  })

  it('формат для поля даты — ГГГГ-ММ-ДД', () => {
    expect(formatDateInput('2026-03-05T12:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('пустая дата даёт текущую дату, а не пустую строку', () => {
    expect(formatDateInput(null)).not.toBe('')
    expect(formatDateInput(undefined)).not.toBe('')
  })

  it('зона — стандартная казахстанская', () => {
    expect(TIME_ZONE).toBe('Asia/Qyzylorda')
  })
})
