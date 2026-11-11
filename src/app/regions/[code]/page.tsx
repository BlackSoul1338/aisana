// ISR: страница отдаётся из кэша мгновенно и пересобирается в фоне
// не чаще раза в 60 секунд — изменения из админки появляются с задержкой до минуты
export const revalidate = 60

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  // Коды регионов в БД хранятся в верхнем регистре, а ссылки с карты
  // ведут на /regions/ast — без toUpperCase() метаданные не находили регион
  // и во вкладке браузера мелькало «Регион не найден», хотя страница открывалась.
  const region = await prisma.region.findFirst({
    where: { code: code.toUpperCase() },
    select: { name: true },
  })
  // Несуществующий код — сразу отдаём страницу «не найдено»,
  // чтобы во вкладке не появлялся заголовок «Регион не найден»
  if (!region) notFound()
  const description = `ИИ-проекты и вузы региона ${region.name}: карта решений, статистика, лучшие практики`
  return {
    title: region.name,
    description,
    openGraph: { title: region.name, description },
  }
}
import { PageLayout } from '@/components/layout/PageLayout'
import Link from 'next/link'
import { ArrowLeft, Building2, FolderKanban, CheckCircle } from 'lucide-react'
import { ProjectCard } from '@/components/ui/project-card'
import { requireUser } from '@/lib/auth'

export default async function RegionPage({ params }: { params: Promise<{ code: string }> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')
  const { code } = await params
  const region = await prisma.region.findFirst({
    where: { code: code.toUpperCase() },
    include: {
      universities: {
        include: {
          _count: { select: { projects: { where: PUBLISHED_ONLY } } },
          projects: {
            where: PUBLISHED_ONLY,
            include: { university: { include: { region: true } }, technologies: true },
            orderBy: { createdAt: 'desc' },
            take: 6,
          },
        },
      },
    },
  })

  if (!region) notFound()

  const totalProjects = region.universities.reduce((s, u) => s + u._count.projects, 0)
  const implementedCount = region.universities.reduce(
    (s, u) => s + u.projects.filter(p => p.status === 'IMPLEMENTED' || p.status === 'SCALED').length, 0
  )
  const allRecentProjects = region.universities.flatMap(u => u.projects)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <PageLayout>
      <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> На карту
      </Link>

      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl p-6 mb-6 text-white">
        <h1 className="text-3xl font-bold mb-1">{region.name}</h1>
        {region.nameKz && <p className="text-blue-200 text-sm mb-4">{region.nameKz}</p>}
        <div className="flex gap-6">
          {[
            { icon: Building2, label: 'Вузов', value: region.universities.length },
            { icon: FolderKanban, label: 'Проектов', value: totalProjects },
            { icon: CheckCircle, label: 'Внедрено', value: implementedCount },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon size={16} className="text-blue-300" />
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-blue-200 text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-4">Университеты ({region.universities.length})</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {region.universities.map(uni => (
          <Link key={uni.id} href={`/universities/${uni.id}`}>
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {(uni.shortName || uni.name).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {uni.shortName && <p className="text-xs font-semibold text-blue-600">{uni.shortName}</p>}
                  <p className="text-sm font-medium text-slate-700 truncate">{uni.name}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <FolderKanban size={12} className="text-blue-400" />
                <span className="font-semibold text-slate-700">{uni._count.projects}</span> проектов
              </div>
            </div>
          </Link>
        ))}
      </div>

      {allRecentProjects.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Последние проекты</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRecentProjects.map(p => (
              <ProjectCard key={p.id} project={p as any} />
            ))}
          </div>
        </>
      )}
    </PageLayout>
  )
}
