import type { Lang } from '@/lib/i18n'

/**
 * Технологии справочника — ровно то, что создаёт prisma/seed.ts.
 * slug — стабильный ключ: в базе лежит только русское name, казахскую
 * подпись держим рядом с категориями.
 */
export const TECHNOLOGY_SLUGS = [
  'gen-ai',
  'machine-learning',
  'computer-vision',
  'nlp',
  'rag',
  'chatbots',
  'other',
] as const

export type TechnologySlug = (typeof TECHNOLOGY_SLUGS)[number]

export const TECHNOLOGY_LABELS = {
  'gen-ai':           { ru: 'Генеративный ИИ (LLM)', kz: 'Генеративті ЖИ (LLM)' },
  'machine-learning': { ru: 'Машинное обучение',     kz: 'Машиналық оқыту' },
  'computer-vision':  { ru: 'Компьютерное зрение',   kz: 'Компьютерлік көру' },
  'nlp':              { ru: 'NLP',                   kz: 'NLP' },
  'rag':              { ru: 'RAG и векторный поиск', kz: 'RAG және векторлық іздеу' },
  'chatbots':         { ru: 'Чат-боты',              kz: 'Чат-боттар' },
  'other':            { ru: 'Другое',                kz: 'Басқа' },
} satisfies Record<TechnologySlug, { ru: string; kz: string }>

/** Неизвестную технологию (добавлена импортом) показываем как записано в базе. */
export function technologyLabel(
  technology: { slug: string; name: string },
  lang: Lang,
): string {
  const label = (TECHNOLOGY_LABELS as Record<string, { ru: string; kz: string }>)[technology.slug]
  return label?.[lang] ?? technology.name
}
