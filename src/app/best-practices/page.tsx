// Страница зависит от пользователя (cookies) — всегда per-request
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY, canModerate } from '@/lib/publication'
import { PageLayout } from '@/components/layout/PageLayout'
import { ProjectCard } from '@/components/ui/project-card'
import { Star, TrendingUp } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { AccessDenied } from '@/components/layout/AccessDenied'

export default async function BestPracticesPage() {
  const user = await getCurrentUser()

  // Раздел содержит внутреннюю аналитику по проектам вузов,
  // поэтому открыт только сотрудникам оператора портала (ADMIN и EDITOR).
  if (!user) {
    return (
      <AccessDenied
        title="Требуется авторизация"
        description="Раздел «Лучшие проекты» доступен только авторизованным пользователям."
        showLogin
        nextPath="/best-practices"
      />
    )
  }

  if (!canModerate(user)) {
    return (
      <AccessDenied description="Раздел «Лучшие проекты» доступен только администраторам и редакторам портала." />
    )
  }

  const bestPractices = await prisma.project.findMany({
    where: {
      ...PUBLISHED_ONLY,
      OR: [{ isBestPractice: true }, { isScalable: true }],
    },
    include: {
      university: { include: { region: true } },
      technologies: true,
    },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
  })

  const highlighted = bestPractices.filter(p => p.isBestPractice)
  const scalable = bestPractices.filter(p => p.isScalable && !p.isBestPractice)

  return (
    <PageLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
            <Star className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Лучшие проекты</h1>
        </div>
        <p className="text-slate-600 max-w-2xl">
          Проекты, признанные наиболее эффективными и рекомендованные для масштабирования в другие
          университеты Казахстана. Критерии отбора: результативность, воспроизводимость, готовность документации.
        </p>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">
            <Star size={14} className="fill-amber-500 text-amber-500" />
            <span><strong>{highlighted.length}</strong> лучших проектов</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-violet-700 bg-violet-100 px-3 py-1.5 rounded-lg">
            <TrendingUp size={14} />
            <span><strong>{scalable.length}</strong> готово к тиражированию</span>
          </div>
        </div>
      </div>

      {highlighted.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Star size={18} className="text-amber-500 fill-amber-500" />
            Лучшие проекты
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highlighted.map(p => (
              <ProjectCard key={p.id} project={p as any} />
            ))}
          </div>
        </section>
      )}

      {scalable.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-violet-500" />
            Готовы к тиражированию
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scalable.map(p => (
              <ProjectCard key={p.id} project={p as any} />
            ))}
          </div>
        </section>
      )}

      {bestPractices.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Star size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Нет лучших проектов</p>
          <p className="text-sm mt-1">Отметьте проекты как «Лучший проект» или «К тиражированию»</p>
        </div>
      )}
    </PageLayout>
  )
}
