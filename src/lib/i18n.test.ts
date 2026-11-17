import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n'

// Казахская локаль не должна проваливаться в русский:
// каждый ключ обязан иметь обе версии, и они не должны совпадать там,
// где язык реально различим (совпадение допустимо для аббревиатур и имён).
describe('i18n parity', () => {
  it('в каждой секции все ключи существуют на обоих языках и не пусты', () => {
    for (const [section, entries] of Object.entries(translations)) {
      for (const [key, value] of Object.entries(entries as Record<string, { ru: string; kz: string }>)) {
        expect(value.ru?.trim(), `${section}.${key}.ru`).toBeTruthy()
        expect(value.kz?.trim(), `${section}.${key}.kz`).toBeTruthy()
      }
    }
  })
})
