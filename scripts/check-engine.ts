/**
 * Проверка ранжирования и порога на реальных данных из БД:
 *   npx tsx scripts/check-engine.ts
 */
import { prisma } from '../src/lib/prisma'
import { indexProject, searchIndex } from '../src/lib/search/engine'
import { PUBLISHED_ONLY } from '../src/lib/publication'

const SELECT = {
  id: true, title: true, description: true, impact: true, results: true,
  tags: true, category: true, status: true, isBestPractice: true, leadName: true,
  technologies: { select: { name: true, slug: true } },
  university: { select: { name: true, shortName: true, region: { select: { name: true } } } },
} as const

async function main() {
  const projects = await prisma.project.findMany({ where: PUBLISHED_ONLY, select: SELECT })
  const index = projects.map(p => indexProject(p as any))
  console.log(`в индексе проектов: ${index.length}\n`)

  for (const q of ['білім', 'Алматы', 'сварка', 'производство', 'жасанды интеллект']) {
    const { query, hits } = searchIndex(index, q, { limit: 10 })
    console.log(`запрос «${q}»: токены=${JSON.stringify(query.tokens)} направления=${query.topics.map(t => t.topic).join(',') || '—'}`)
    if (hits.length === 0) console.log('   НИЧЕГО НЕ НАЙДЕНО')
    for (const h of hits) console.log(`   score=${h.score} rank=${h.rank.toFixed(1)} ${h.id}`)
    console.log()
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
