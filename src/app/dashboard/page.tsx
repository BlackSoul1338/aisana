// force-dynamic + кэш в data-cache (см. комментарий в src/app/page.tsx)
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { cached } from '@/lib/data-cache'
import { PageLayout } from '@/components/layout/PageLayout'
import { DashboardCharts } from '@/components/charts/DashboardCharts'
import { DashboardKPI } from '@/components/charts/DashboardKPI'
import { requireUser } from '@/lib/auth'
import { isDescriptionEmpty } from '@/lib/project-completeness'

// Минимальное количество проектов на вуз (KPI)
const UNIVERSITY_KPI_TARGET = 13

async function getDashboardData() {
  const [
    totalUniversities, totalProjects, implementedProjects, scaledProjects,
    inProgressProjects, byRegion, byStatus, byCategory, allUniversities,
    teamAgg, bestPracticesCount, technologies, topViewed, topSearched, stageRows,
  ] = await Promise.all([
    prisma.university.count(),
    prisma.project.count({ where: PUBLISHED_ONLY }),
    prisma.project.count({ where: { ...PUBLISHED_ONLY, status: 'IMPLEMENTED' } }),
    prisma.project.count({ where: { ...PUBLISHED_ONLY, status: 'SCALED' } }),
    prisma.project.count({ where: { ...PUBLISHED_ONLY, status: { in: ['PROTOTYPE', 'PILOT'] } } }),
    prisma.region.findMany({
      include: { universities: { include: { _count: { select: { projects: { where: PUBLISHED_ONLY } } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.project.groupBy({ by: ['status'], _count: { id: true }, where: PUBLISHED_ONLY }),
    prisma.project.groupBy({ by: ['category'], _count: { id: true }, where: PUBLISHED_ONLY }),
    prisma.university.findMany({
      include: { _count: { select: { projects: { where: PUBLISHED_ONLY } } } },
      orderBy: { projects: { _count: 'desc' } },
    }),
    // _count.teamSize — в скольких карточках размер команды вообще указан:
    // сумма без этого числа выглядит как «всего участников», хотя поле заполнено не везде
    prisma.project.aggregate({ _sum: { teamSize: true }, _count: { teamSize: true }, where: PUBLISHED_ONLY }),
    prisma.project.count({ where: { ...PUBLISHED_ONLY, isBestPractice: true } }),
    prisma.technology.findMany({
      include: { _count: { select: { projects: { where: PUBLISHED_ONLY } } } },
      orderBy: { projects: { _count: 'desc' } },
      take: 8,
    }),
    prisma.project.findMany({
      where: { ...PUBLISHED_ONLY, viewCount: { gt: 0 } },
      orderBy: { viewCount: 'desc' },
      take: 5,
      select: { id: true, title: true, viewCount: true },
    }),
    prisma.project.findMany({
      where: { ...PUBLISHED_ONLY, searchHitCount: { gt: 0 } },
      orderBy: { searchHitCount: 'desc' },
      take: 5,
      select: { id: true, title: true, searchHitCount: true },
    }),
    // Для разбивки по стадиям и отраслям нужны сами тексты: «подтверждено»
    // и «без описания» считаются по содержимому карточки, а не группировкой
    prisma.project.findMany({
      where: PUBLISHED_ONLY,
      select: {
        status: true, industry: true, description: true, impact: true, results: true,
        implementedAt: true, agentPassportPdf: true, _count: { select: { files: true } },
      },
    }),
  ])

  // ── Стадии: сколько карточек подтверждено материалами ──────
  // Подтверждение — любой из признаков: файл или ссылка, паспорт агента,
  // эффект, результаты, место внедрения. Стадию вуз указывает сам, поэтому
  // «внедрено» без единого подтверждения показываем отдельно.
  const stageMap = new Map<string, { total: number; confirmed: number; noDescription: number }>()
  const industryMap = new Map<string, number>()
  for (const p of stageRows) {
    const row = stageMap.get(p.status) ?? { total: 0, confirmed: 0, noDescription: 0 }
    row.total += 1
    if (p._count.files > 0 || p.agentPassportPdf || p.impact?.trim() || p.results?.trim() || p.implementedAt?.trim()) row.confirmed += 1
    if (isDescriptionEmpty(p.description)) row.noDescription += 1
    stageMap.set(p.status, row)
    const industry = p.industry ?? 'NONE'
    industryMap.set(industry, (industryMap.get(industry) ?? 0) + 1)
  }

  // ── KPI вузов: минимум N проектов на вуз ───────────────────
  // Вузы без проектов показываем отдельной строкой: семьдесят строк с нулём
  // в начале списка закрывали тех, кому до цели осталось немного
  const withoutProjects = allUniversities.filter(u => u._count.projects === 0)
  const failingUniversities = allUniversities
    .filter(u => u._count.projects > 0 && u._count.projects < UNIVERSITY_KPI_TARGET)
    .map(u => ({
      name: u.name,
      shortName: u.shortName || u.name,
      count: u._count.projects,
      missing: UNIVERSITY_KPI_TARGET - u._count.projects,
    }))
    // Сначала те, кому до цели ближе всего
    .sort((a, b) => a.missing - b.missing)
  const universityKpi = {
    target: UNIVERSITY_KPI_TARGET,
    met: allUniversities.length - failingUniversities.length - withoutProjects.length,
    notMet: failingUniversities.length + withoutProjects.length,
    failing: failingUniversities,
    withoutProjects: withoutProjects.map(u => u.shortName || u.name),
  }

  // ── Проекты по регионам ────────────────────────────────────
  const regionCounts = byRegion.map(r => ({
    name: r.name,
    nameKz: r.nameKz,
    count: r.universities.reduce((s, u) => s + u._count.projects, 0),
  }))

  return {
    kpi: {
      totalUniversities,
      universitiesWithProjects: allUniversities.length - withoutProjects.length,
      totalProjects,
      implementedProjects: implementedProjects + scaledProjects,
      inProgressProjects,
      teamMembers: teamAgg._sum.teamSize ?? 0,
      teamProjects: teamAgg._count.teamSize,
      bestPractices: bestPracticesCount,
    },
    universityKpi,
    byRegion: regionCounts.filter(r => r.count > 0).sort((a, b) => b.count - a.count),
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
    byCategory: byCategory.map(c => ({ category: c.category, count: c._count.id })),
    stages: [...stageMap].map(([status, row]) => ({ status, ...row })),
    byIndustry: [...industryMap].map(([industry, count]) => ({ industry, count })),
    technologies: technologies
      .map(tech => ({ name: tech.name, count: tech._count.projects }))
      .filter(tech => tech.count > 0),
    topViewed,
    topSearched,
    topUniversities: allUniversities
      .map(u => ({ name: u.name, shortName: u.shortName || u.name, count: u._count.projects }))
      .filter(u => u.count > 0)
      .slice(0, 10),
  }
}

export default async function DashboardPage() {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')
  const data = await cached('dashboard', 60_000, getDashboardData)

  return (
    <PageLayout>
      <DashboardKPI kpi={data.kpi} />
      <DashboardCharts
        universityKpi={data.universityKpi}
        byRegion={data.byRegion}
        byStatus={data.byStatus}
        byCategory={data.byCategory}
        stages={data.stages}
        byIndustry={data.byIndustry}
        technologies={data.technologies}
        topViewed={data.topViewed}
        topSearched={data.topSearched}
        topUniversities={data.topUniversities}
      />
    </PageLayout>
  )
}
