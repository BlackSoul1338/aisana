import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SHOWCASE_WHERE } from '@/lib/publication'
import { requireRole } from '@/lib/auth'
import { PageLayout } from '@/components/layout/PageLayout'
import { SolutionsView } from '@/components/solutions/SolutionsView'

const PAGE_SIZE = 24

interface Params {
  tech?: string
  page?: string
}

/** Витрина для бизнеса: опубликованные проекты, открытые модератором для интеграции. */
export default async function SolutionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole([UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR], '/business/solutions')

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const where = {
    ...SHOWCASE_WHERE,
    ...(sp.tech ? { technologies: { some: { slug: sp.tech } } } : {}),
  }

  const [projects, total, technologies] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        category: true,
        university: { select: { name: true, shortName: true } },
        technologies: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where }),
    prisma.technology.findMany({
      where: { projects: { some: SHOWCASE_WHERE } },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <PageLayout>
      <SolutionsView
        projects={projects}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        tech={sp.tech}
        technologies={technologies}
      />
    </PageLayout>
  )
}
