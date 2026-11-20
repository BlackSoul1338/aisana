import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TECHNOLOGY_LABELS, TECHNOLOGY_SLUGS, technologyLabel } from '@/lib/technologies'

describe('technologyLabel', () => {
  it('переводит известные технологии и не трогает неизвестные', () => {
    expect(technologyLabel({ slug: 'computer-vision', name: 'Компьютерное зрение' }, 'kz')).toBe('Компьютерлік көру')
    expect(technologyLabel({ slug: 'computer-vision', name: 'Компьютерное зрение' }, 'ru')).toBe('Компьютерное зрение')
    // технология добавлена импортом — казахской подписи нет
    expect(technologyLabel({ slug: 'tesseract-ocr', name: 'Tesseract OCR' }, 'kz')).toBe('Tesseract OCR')
  })

  it('таблица покрывает все технологии из prisma/seed.ts', () => {
    const seed = readFileSync('prisma/seed.ts', 'utf8')
    const seeded = [...seed.matchAll(/name: '([^']*)',\s*slug: '([^']+)'/g)].map(m => ({ name: m[1], slug: m[2] }))
    expect(seeded.length).toBeGreaterThan(0)
    expect(seeded.map(t => t.slug).sort()).toEqual([...TECHNOLOGY_SLUGS].sort())
    expect(Object.keys(TECHNOLOGY_LABELS).sort()).toEqual([...TECHNOLOGY_SLUGS].sort())
    // импорт пишет name из TECHNOLOGY_LABELS.ru — расхождение создаст дубль в БД
    for (const tech of seeded) {
      expect(TECHNOLOGY_LABELS[tech.slug as keyof typeof TECHNOLOGY_LABELS].ru).toBe(tech.name)
    }
  })
})
