import type { ProjectIndustry } from '@prisma/client'

/**
 * Отрасль применения решения.
 *
 * Не путать с категорией проекта: категория — это тип технологии
 * (генеративный ИИ, аналитика, компьютерное зрение), а отрасль — сфера,
 * где решение работает. Чат-бот приёмной комиссии: категория «Генеративный
 * ИИ», отрасль «Образование и наука».
 */
export const INDUSTRIES: { value: ProjectIndustry; ru: string; kz: string }[] = [
  { value: 'EDUCATION_SCIENCE', ru: 'Образование и наука', kz: 'Білім және ғылым' },
  { value: 'HEALTHCARE', ru: 'Здравоохранение и медицина', kz: 'Денсаулық сақтау және медицина' },
  { value: 'FINANCE_BUSINESS', ru: 'Финансы, торговля и бизнес', kz: 'Қаржы, сауда және бизнес' },
  { value: 'INDUSTRY_MINING', ru: 'Промышленность и горнодобыча', kz: 'Өнеркәсіп және тау-кен өндірісі' },
  { value: 'ENERGY', ru: 'Энергетика, нефть и газ', kz: 'Энергетика, мұнай және газ' },
  { value: 'AGRICULTURE', ru: 'Сельское хозяйство', kz: 'Ауыл шаруашылығы' },
  { value: 'TRANSPORT', ru: 'Транспорт и логистика', kz: 'Көлік және логистика' },
  { value: 'CONSTRUCTION', ru: 'Строительство и городская среда', kz: 'Құрылыс және қала ортасы' },
  { value: 'IT_SECURITY', ru: 'ИТ и кибербезопасность', kz: 'АТ және киберқауіпсіздік' },
  { value: 'GOVERNMENT', ru: 'Государственное управление и безопасность', kz: 'Мемлекеттік басқару және қауіпсіздік' },
  { value: 'LAW', ru: 'Право', kz: 'Құқық' },
  { value: 'ECOLOGY', ru: 'Экология и природные ресурсы', kz: 'Экология және табиғи ресурстар' },
  { value: 'CULTURE_TOURISM_SPORT', ru: 'Культура, туризм и спорт', kz: 'Мәдениет, туризм және спорт' },
  { value: 'SOCIAL', ru: 'Социальная сфера и инклюзия', kz: 'Әлеуметтік сала және инклюзия' },
  { value: 'OTHER', ru: 'Другое', kz: 'Басқа' },
]

export function industryLabel(value: string | null | undefined, lang: 'ru' | 'kz' = 'ru'): string {
  return INDUSTRIES.find(industry => industry.value === value)?.[lang] ?? ''
}
