import { t, type Lang } from './i18n'

/**
 * Русское склонение после числа: plural(21, 'проект', 'проекта', 'проектов') → «проект».
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/** Единица после числа из i18n (common.unit*): ru склоняется, kz — одна форма. */
export function pluralUnit(count: number, lang: Lang, key: 'unitProject' | 'unitUniversity' | 'unitSolution'): string {
  const forms = t('common', key, lang)
  if (lang === 'kz') return forms
  const [one, few, many] = forms.split('|')
  return plural(count, one, few, many)
}
