// force-dynamic + кэш в data-cache: рендер на каждый запрос, но данные
// обновляются раз в 60 сек. ВАЖНО: revalidate здесь нельзя — при сборке
// Docker-образа нет БД, и пререндер валит `npm run build`.
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { cached } from '@/lib/data-cache'
import KazakhstanMap from '@/components/map/KazakhstanMap'
import { Navbar } from '@/components/layout/Navbar'
import { MapOverlay } from '@/components/map/MapOverlay'

async function getMapData() {
  const regions = await prisma.region.findMany({
    include: {
      universities: {
        include: { _count: { select: { projects: { where: PUBLISHED_ONLY } } } },
      },
    },
  })

  const [totalProjects, totalUniversities] = await Promise.all([
    prisma.project.count({ where: PUBLISHED_ONLY }),
    prisma.university.count(),
  ])

  const regionsWithStats = regions.map(region => ({
    id: region.id,
    name: region.name,
    nameKz: region.nameKz,
    code: region.code,
    center: region.center,
    universityCount: region.universities.length,
    projectCount: region.universities.reduce((sum, u) => sum + u._count.projects, 0),
  }))

  return {
    regions: regionsWithStats,
    stats: { totalUniversities, totalProjects },
  }
}

export default async function HomePage() {
  const { regions, stats } = await cached('map-page', 60_000, getMapData)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-[#0d1b3e]">
      <Navbar />
      <main className="flex-1 relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(26,86,219,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(26,86,219,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        <MapOverlay stats={stats} />
        <KazakhstanMap regions={regions} />
      </main>
    </div>
  )
}
