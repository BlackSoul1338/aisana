import { describe, expect, it } from 'vitest'
import { tagLabel } from '@/lib/tags'

describe('tagLabel', () => {
  it('переводит известные теги, сохраняя регистр первой буквы', () => {
    expect(tagLabel('сварка', 'kz')).toBe('металл пісіру')
    expect(tagLabel('Сварка', 'kz')).toBe('Металл пісіру')
    expect(tagLabel('СВАРКА', 'kz')).toBe('Металл пісіру')
    expect(tagLabel('#Сварка', 'kz')).toBe('Металл пісіру')
  })

  it('ищет без учёта регистра, ё и лишних пробелов', () => {
    expect(tagLabel('  Контроль   качества ', 'kz')).toBe('Сапа бақылауы')
    expect(tagLabel('КОНТРОЛЬ КАЧЕСТВА', 'kz')).toBe('Сапа бақылауы')
  })

  it('свободный текст автора остаётся как есть', () => {
    expect(tagLabel('қазақ тілі', 'kz')).toBe('қазақ тілі')
    expect(tagLabel('сварка', 'ru')).toBe('сварка')
  })
})
