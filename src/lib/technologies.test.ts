import { describe, expect, it } from 'vitest'
import { technologyLabel } from '@/lib/technologies'

describe('technologyLabel', () => {
  it('известные технологии справочника переводятся, неизвестные — как в базе', () => {
    expect(technologyLabel({ slug: 'computer-vision', name: 'Компьютерное зрение' }, 'kz')).toBe('Компьютерлік көру')
    expect(technologyLabel({ slug: 'computer-vision', name: 'Компьютерное зрение' }, 'ru')).toBe('Компьютерное зрение')
    // технология добавлена импортом — казахской подписи нет
    expect(technologyLabel({ slug: 'tesseract-ocr', name: 'Tesseract OCR' }, 'kz')).toBe('Tesseract OCR')
  })
})
