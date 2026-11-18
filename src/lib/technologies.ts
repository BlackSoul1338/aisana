import type { Lang } from '@/lib/i18n'

/**
 * Технологии справочника (prisma/seed.ts). slug — стабильный ключ: в базе
 * лежит только русское name, казахскую подпись держим рядом с категориями.
 */
const TECHNOLOGY_LABELS: Record<string, { ru: string; kz: string }> = {
  'gen-ai':           { ru: 'Генеративный ИИ (LLM)', kz: 'Генеративті ЖИ (LLM)' },
  'machine-learning': { ru: 'Машинное обучение',     kz: 'Машиналық оқыту' },
  'computer-vision':  { ru: 'Компьютерное зрение',   kz: 'Компьютерлік көру' },
  'nlp':              { ru: 'NLP',                   kz: 'NLP' },
  'rag':              { ru: 'RAG и векторный поиск', kz: 'RAG және векторлық іздеу' },
  'chatbots':         { ru: 'Чат-боты',              kz: 'Чат-боттар' },
  'other':            { ru: 'Другое',                kz: 'Басқа' },
}

/** Неизвестную технологию (добавлена импортом) показываем как записано в базе. */
export function technologyLabel(
  technology: { slug: string; name: string },
  lang: Lang,
): string {
  return TECHNOLOGY_LABELS[technology.slug]?.[lang] ?? technology.name
}
