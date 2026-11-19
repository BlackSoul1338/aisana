import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n'

// Казахская локаль не должна проваливаться в русский:
// каждый ключ обязан иметь обе версии, и они не должны совпадать там,
// где язык реально различим (совпадение допустимо для аббревиатур и имён).
// Совпадение ru/kz допустимо только там, где слово одинаково в обоих языках:
// аббревиатуры, имена, заимствования. Новый ключ с kz-копией ru должен падать.
const IDENTICAL_OK = new Set([
  'status.IDEA', 'status.PROTOTYPE', 'category.ANALYTICS', 'category.ROBOTICS',
  'audit.action_IMPORT', 'role.EDITOR', 'admin.navImport', 'importSection.file',
  'users.company', 'universityForm.phone', 'login.email', 'contacts.emailLabel',
  'nav.map', 'home.title', 'universities.rector', 'universities.website',
  'project.team', 'project.pdfPresentation', 'project.pptxPresentation',
  'project.fileTypePresentation', 'project.tabStats', 'hearings.commission',
  'university.rector', 'university.email', 'university.site',
  'requestForm.phoneLabel', 'requestType.DEMO', 'requestType.CONSULTATION', 'requestType.PILOT',
  'common.ms',
])

describe('i18n parity', () => {
  it('в каждой секции все ключи существуют на обоих языках и не пусты', () => {
    for (const [section, entries] of Object.entries(translations)) {
      for (const [key, value] of Object.entries(entries as Record<string, { ru: string; kz: string }>)) {
        expect(value.ru?.trim(), `${section}.${key}.ru`).toBeTruthy()
        expect(value.kz?.trim(), `${section}.${key}.kz`).toBeTruthy()
      }
    }
  })

  it('kz не копирует ru вне списка одинаковых слов', () => {
    for (const [section, entries] of Object.entries(translations)) {
      for (const [key, value] of Object.entries(entries as Record<string, { ru: string; kz: string }>)) {
        if (IDENTICAL_OK.has(`${section}.${key}`)) continue
        expect(value.kz, `${section}.${key}`).not.toBe(value.ru)
      }
    }
  })
})
