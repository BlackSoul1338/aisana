/**
 * Хранение поискового индекса.
 *
 * Классификация проекта пересчитывается при каждом сохранении и складывается
 * в таблицу project_topics — чтобы направления можно было показывать на
 * странице проекта, фильтровать по ним реестр и видеть в админке, не запуская
 * классификатор заново на каждый запрос.
 *
 * Сам поиск работает по индексу в памяти (см. loadSearchIndex): проектов
 * несколько сотен, полный разбор занимает миллисекунды и кэшируется.
 */

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'
import { cached, invalidate } from '@/lib/data-cache'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { classifyProject } from './classify'
import { indexProject, type IndexedProject } from './engine'

/** Поля, которые нужны классификатору и поиску. */
const PROJECT_SELECT = {
  id: true,
  title: true,
  description: true,
  impact: true,
  results: true,
  tags: true,
  category: true,
  status: true,
  isBestPractice: true,
  leadName: true,
  technologies: { select: { name: true, slug: true } },
  university: { select: { name: true, shortName: true, region: { select: { name: true } } } },
} as const

type Db = PrismaClient | typeof defaultPrisma

/** Пересчитывает и сохраняет направления одного проекта. */
export async function reclassifyProject(projectId: string, db: Db = defaultPrisma): Promise<number> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: PROJECT_SELECT })
  if (!project) return 0

  const topics = classifyProject(project as any)

  await db.projectTopic.deleteMany({ where: { projectId } })
  if (topics.length > 0) {
    await db.projectTopic.createMany({
      data: topics.map(topic => ({
        projectId,
        topic: topic.topic,
        score: topic.score,
        explanation: topic.explanation,
        signals: [...new Set(topic.signals.map(s => s.term))].slice(0, 12),
      })),
    })
  }

  return topics.length
}

/**
 * Полная переиндексация: пересчитывает направления у всех проектов.
 * Запускается после правки справочника направлений или массового импорта.
 */
export async function reindexAllProjects(db: Db = defaultPrisma): Promise<{
  projects: number
  topics: number
  durationMs: number
}> {
  const startedAt = Date.now()
  const projects = await db.project.findMany({ select: PROJECT_SELECT })

  let topicCount = 0
  const rows: { projectId: string; topic: string; score: number; explanation: string; signals: string[] }[] = []

  for (const project of projects) {
    for (const topic of classifyProject(project as any)) {
      rows.push({
        projectId: project.id,
        topic: topic.topic,
        score: topic.score,
        explanation: topic.explanation,
        signals: [...new Set(topic.signals.map(s => s.term))].slice(0, 12),
      })
      topicCount += 1
    }
  }

  await db.projectTopic.deleteMany({})
  if (rows.length) {
    // Порциями, чтобы не упереться в лимит параметров запроса
    for (let i = 0; i < rows.length; i += 500) {
      await db.projectTopic.createMany({ data: rows.slice(i, i + 500) })
    }
  }

  return { projects: projects.length, topics: topicCount, durationMs: Date.now() - startedAt }
}

/**
 * Индекс для поиска: все опубликованные проекты, разобранные по полям
 * и классифицированные. Кэшируется на минуту — так поиск не пересобирает
 * индекс на каждый запрос, но правки из админки появляются быстро.
 */
const SEARCH_INDEX_KEY = 'search-index'

export async function loadSearchIndex(db: Db = defaultPrisma): Promise<IndexedProject[]> {
  return cached(SEARCH_INDEX_KEY, 60_000, async () => {
    const projects = await db.project.findMany({
      where: PUBLISHED_ONLY,
      select: PROJECT_SELECT,
      // Второй ключ — детерминированный порядок среди равных createdAt:
      // без него выдача могла «прыгать» между пересборками индекса
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return projects.map(project => indexProject(project as any))
  })
}

/** Сбрасывает кэш индекса — вызывается после правки или публикации проекта. */
export function invalidateSearchIndex(): void {
  invalidate(SEARCH_INDEX_KEY)
}
