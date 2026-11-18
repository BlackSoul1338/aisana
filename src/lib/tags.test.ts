import { describe, expect, it } from 'vitest'
import { tagLabel } from '@/lib/tags'

describe('tagLabel', () => {
  it('переводит известные теги и оставляет свободный текст автора', () => {
    expect(tagLabel('Сварка', 'kz')).toBe('пісіру')
    expect(tagLabel('сварка', 'ru')).toBe('сварка')
    // тег не из справочника — показываем как ввёл автор
    expect(tagLabel('қазақ тілі', 'kz')).toBe('қазақ тілі')
  })
})
