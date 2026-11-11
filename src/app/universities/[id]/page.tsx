// ISR: страница отдаётся из кэша мгновенно и пересобирается в фоне
// не чаще раза в 60 секунд — изменения из админки появляются с задержкой до минуты
export const revalidate = 60

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import type { Metadata } from 'next'
import { metaDescription } from '@/lib/seo'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const uni = await prisma.university.findUnique({
    where: { id },
    select: { name: true, shortName: true, description: true, region: { select: { name: true } } },
  })
  if (!uni) return { title: 'Вуз не найден' }

  const description = metaDescription(
    uni.description,
    `ИИ-проекты вуза ${uni.shortName || uni.name} (${uni.region.name})`
  )
  return {
    title: uni.shortName ? `${uni.shortName} — ${uni.name}` : uni.name,
    description,
    openGraph: { title: uni.name, description },
  }
}
import { PageLayout } from '@/components/layout/PageLayout'
import { ProjectCard } from '@/components/ui/project-card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Mail, Globe, User, FolderKanban, ArrowLeft, Pencil } from 'lucide-react'
import { requireUser } from '@/lib/auth'

export default async function UniversityPage({ params }: { params: Promise<{ id: string }> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')
  const { id } = await params
  const university = await prisma.university.findUnique({
    where: { id },
    include: {
      region: true,
      projects: {
        where: PUBLISHED_ONLY,
        include: {
          university: { include: { region: true } },
          technologies: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!university) notFound()

  const implementedCount = university.projects.filter(
    p => p.status === 'IMPLEMENTED' || p.status === 'SCALED'
  ).length

  return (
    <PageLayout>
      <Link href="/universities" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Все вузы
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {(university.shortName || university.name).slice(0, 2).toUpperCase()}
            </div>
            <div>
              {university.shortName && <p className="text-blue-600 font-semibold text-sm mb-1">{university.shortName}</p>}
              <h1 className="text-2xl font-bold text-slate-800">{university.name}</h1>
              {university.nameKz && <p className="text-slate-400 text-sm mt-1">{university.nameKz}</p>}
            </div>
          </div>
          <Link href={`/admin/universities/${university.id}/edit`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300">
            <Pencil size={13} /> Редактировать
          </Link>
        </div>

        {university.description && (
          <p className="text-slate-600 text-sm mt-4 leading-relaxed max-w-3xl">{university.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { icon: MapPin, label: 'Регион', value: university.region.name },
            { icon: User, label: 'Ректор', value: university.rector || '—' },
            { icon: Mail, label: 'Email', value: university.email || '—' },
            { icon: Globe, label: 'Сайт', value: university.website?.replace('https://', '') || '—' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <item.icon size={11} />{item.label}
              </div>
              <p className="text-sm font-medium text-slate-700 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6 mt-6 pt-5 border-t border-slate-100">
          <div>
            <div className="text-2xl font-bold text-slate-800">{university.projects.length}</div>
            <div className="text-xs text-slate-400">Всего проектов</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{implementedCount}</div>
            <div className="text-xs text-slate-400">Внедрено</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FolderKanban size={18} className="text-blue-500" />
          ИИ-проекты ({university.projects.length})
        </h2>
        <Link href={`/admin/projects/new?universityId=${university.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          + Добавить проект
        </Link>
      </div>

      {university.projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {university.projects.map(project => (
            <ProjectCard key={project.id} project={project as any} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl text-slate-400">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Нет проектов</p>
        </div>
      )}
    </PageLayout>
  )
}
