import type { PrismaClient } from '@prisma/client'
import { loadSearchIndex } from '@/lib/search/store'
import { searchIndex } from '@/lib/search/engine'
import { SHOWCASE_WHERE } from '@/lib/publication'
import { NOT_SPECIFIED, type FieldState, type NeedFieldKey } from './readiness'

/** По этим полям ищется решение: остальные (контур, интеграции, масштаб) в карточках проектов не описаны. */
const QUERY_FIELDS: NeedFieldKey[] = ['task', 'problem', 'goal']
const RAW_QUERY_LIMIT = 500

/**
 * Ниже этой оценки совпадения случайны: на длинном тексте потребности поиск
 * уходит в нестрогий режим и цепляет проекты за одно общее слово (спайк на
 * задачах Sana: шум 1–4 балла, осмысленные совпадения от 30).
 */
export const MATCH_MIN_SCORE = 10
export const MATCH_LIMIT = 5

/** Запрос к поиску: подтверждённые значения полей, а пока их нет — сами реплики компании. */
export function needQuery(fields: FieldState[], businessMessages: string[]): string {
  const values = fields
    .filter(f => QUERY_FIELDS.includes(f.key) && f.status !== 'missing' && f.value !== NOT_SPECIFIED)
    .map(f => f.value)
  if (values.length) return values.join('. ')
  return businessMessages.join(' ').slice(0, RAW_QUERY_LIMIT)
}

export type NeedMatch = {
  id: string
  title: string
  university: string
  score: number
  reason: string
}

/** Подборка из витрины решений. Ранжирует тот же поиск, что и каталог. */
export async function matchProjects(db: PrismaClient, query: string): Promise<NeedMatch[]> {
  if (!query.trim()) return []
  const index = await loadSearchIndex(db)
  // Считаем весь каталог: срез до фильтра по витрине выбрал бы пять проектов
  // без флага и подборка осталась бы пустой при сильных совпадениях ниже.
  const hits = searchIndex(index, query, { limit: index.length, minScore: MATCH_MIN_SCORE }).hits
  if (!hits.length) return []

  const projects = await db.project.findMany({
    where: { id: { in: hits.map(h => h.id) }, ...SHOWCASE_WHERE },
    select: { id: true, title: true, university: { select: { name: true, shortName: true } } },
  })
  const byId = new Map(projects.map(p => [p.id, p]))
  return hits.flatMap(hit => {
    const project = byId.get(hit.id)
    if (!project) return []
    return [{
      id: project.id,
      title: project.title,
      university: project.university?.shortName || project.university?.name || '',
      score: hit.score,
      reason: hit.debug.reason,
    }]
  }).slice(0, MATCH_LIMIT)
}
