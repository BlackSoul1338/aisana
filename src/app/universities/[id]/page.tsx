export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import type { Metadata } from 'next'
import { metaDescription } from '@/lib/seo'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const lang = await getRequestLang()
  const { id } = await params
  const uni = await prisma.university.findUnique({
    where: { id },
    select: { name: true, shortName: true, description: true, region: { select: { name: true } } },
  })
  if (!uni) return { title: t('universities', 'metaUniNotFound', lang) }

  const description = metaDescription(
    uni.description,
    `${t('universities', 'metaAiProjects', lang)} ${uni.shortName || uni.name} (${uni.region.name})`
  )
  return {
    title: uni.shortName ? `${uni.shortName} - ${uni.name}` : uni.name,
    description,
    openGraph: { title: uni.name, description },
  }
}
import { PageLayout } from '@/components/layout/PageLayout'
import { ProjectCard } from '@/components/ui/project-card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Mail, Globe, User, FolderKanban, ArrowLeft, Pencil } from 'lucide-react'
import { canAccessUniversity, requireUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'

export default async function UniversityPage({ params }: { params: Promise<{ id: string }> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  const user = await requireUser('/')
  const lang = await getRequestLang()
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
        <ArrowLeft size={14} /> {t('universities', 'allUniversities', lang)}
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
          {canModerate(user) && (
            <Link href={`/admin/universities/${university.id}/edit`}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300">
              <Pencil size={13} /> {t('common', 'edit', lang)}
            </Link>
          )}
        </div>

        {university.description && (
          <p className="text-slate-600 text-sm mt-4 leading-relaxed max-w-3xl">{university.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { icon: MapPin, label: t('universities', 'regionLabel', lang), value: lang === 'kz' && university.region.nameKz ? university.region.nameKz : university.region.name },
            { icon: User, label: t('universities', 'rector', lang), value: university.rector || '-' },
            { icon: Mail, label: 'Email', value: university.email || '-' },
            { icon: Globe, label: t('universities', 'website', lang), value: university.website?.replace('https://', '') || '-' },
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
            <div className="text-xs text-slate-400">{t('universities', 'totalProjects', lang)}</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{implementedCount}</div>
            <div className="text-xs text-slate-400">{t('universities', 'implementedCount', lang)}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <FolderKanban size={18} className="text-blue-500" />
          {t('projects', 'title', lang)} ({university.projects.length})
        </h2>
        {canAccessUniversity(user, university.id) && (
          <Link href={`/admin/projects/new?universityId=${university.id}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + {t('projects', 'addProject', lang)}
          </Link>
        )}
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
          <p className="font-medium">{t('universities', 'noProjects', lang)}</p>
        </div>
      )}
    </PageLayout>
  )
}
