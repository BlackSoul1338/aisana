// ISR: страница отдаётся из кэша мгновенно и пересобирается в фоне
// не чаще раза в 60 секунд — изменения из админки появляются с задержкой до минуты
export const revalidate = 60

import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import { metaDescription } from '@/lib/seo'
import { PublicationStatus } from '@prisma/client'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      publication: true,
      universityId: true,
      university: { select: { name: true, shortName: true } },
    },
  })
  // Черновик или проект на проверке публично недоступен —
  // отдаём «не найдено» до начала отрисовки страницы
  if (!project || project.publication !== PublicationStatus.PUBLISHED) notFound()

  const uni = project.university.shortName || project.university.name
  const description = metaDescription(project.description, `ИИ-проект вуза ${uni}`)
  return {
    title: project.title,
    description,
    openGraph: { title: `${project.title} · ${uni}`, description },
  }
}
import { PageLayout } from '@/components/layout/PageLayout'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import {
  ArrowLeft, Building2, User, Users, Calendar,
  Star, TrendingUp, Pencil, Mic, FileText, Layers, MapPin
} from 'lucide-react'
import { industryLabel } from '@/lib/industries'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { formatDateLong } from '@/lib/utils'
import { HEARING_DECISION_LABELS } from '@/types'
import { HearingDecision } from '@prisma/client'
import { ProjectTabs } from '@/components/project/ProjectTabs'
import { AgentPassportViewer } from '@/components/project/AgentPassportViewer'
import { ProjectFilesManager } from '@/components/project/ProjectFilesManager'
import { ProjectStats } from '@/components/project/ProjectStats'
import { ProjectStatsTab } from '@/components/project/ProjectStatsTab'
import { ProjectTopics } from '@/components/project/ProjectTopics'
import { TOPICS } from '@/lib/search/taxonomy'
import { ShareButton } from '@/components/project/ShareButton'

const HEARING_COLORS: Record<HearingDecision, string> = {
  PENDING:     'bg-slate-100 text-slate-600',
  APPROVED:    'bg-emerald-100 text-emerald-700',
  REJECTED:    'bg-red-100 text-red-700',
  REVISION:    'bg-amber-100 text-amber-700',
  RECOMMENDED: 'bg-violet-100 text-violet-700',
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      university: { include: { region: true } },
      technologies: true,
      hearings: { orderBy: { date: 'desc' } },
      files: { orderBy: { createdAt: 'asc' } },
      topics: { orderBy: { score: 'desc' } },
    },
  })

  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')

  // Неопубликованные проекты доступны только в админ-панели:
  // просмотр и редактирование — на /admin/projects/[id]/edit
  if (!project || project.publication !== PublicationStatus.PUBLISHED) notFound()

  const topicLabels = Object.fromEntries(TOPICS.map(topic => [topic.id, topic.label]))

  // ── Overview tab ─────────────────────────────────────────
  const overviewContent = (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-slate-600 leading-relaxed">{project.description}</p>
        {project.impact && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Влияние</p>
            <p className="text-sm text-slate-700">{project.impact}</p>
          </div>
        )}
        {project.results && (
          <div className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Результаты</p>
            <p className="text-sm text-slate-700">{project.results}</p>
          </div>
        )}
      </div>

      {project.technologies.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-3">Технологии</h2>
          <div className="flex flex-wrap gap-2">
            {project.technologies.map(tech => (
              <Link key={tech.id} href={`/projects?tech=${tech.slug}`}
                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                {tech.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Mic size={16} className="text-slate-400" />
            Заслушивания ({project.hearings.length})
          </h2>
          <Link href={`/admin/hearings/new?projectId=${project.id}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            + Добавить
          </Link>
        </div>
        {project.hearings.length > 0 ? (
          <div className="space-y-3">
            {project.hearings.map(hearing => (
              <div key={hearing.id} className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-slate-700">{formatDateLong(hearing.date)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEARING_COLORS[hearing.decision]}`}>
                    {HEARING_DECISION_LABELS[hearing.decision]}
                  </span>
                </div>
                {hearing.remarks && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">Замечания: </span>{hearing.remarks}
                  </p>
                )}
                {hearing.recommendations && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">Рекомендации: </span>{hearing.recommendations}
                  </p>
                )}
                {hearing.commission.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">Комиссия: {hearing.commission.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Заслушивания ещё не проводились</p>
        )}
      </div>

      <ProjectTopics topics={project.topics} labels={topicLabels} />

      {project.tags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-3">Теги</h2>
          <div className="flex flex-wrap gap-2">
            {project.tags.map(tag => (
              <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Passport tab — PDF viewer ────────────────────────────
  const passportContent = (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <FileText size={18} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">Паспорт агента</h2>
          <p className="text-xs text-slate-400 mt-0.5">PDF-документ с описанием ИИ-агента</p>
        </div>
      </div>
      <AgentPassportViewer projectId={project.id} initialUrl={project.agentPassportPdf} />
    </div>
  )

  // ── Files tab ─────────────────────────────────────────────
  const filesContent = (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="mb-5 pb-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">Файлы и ссылки</h2>
        <p className="text-xs text-slate-400 mt-1">
          Акты внедрения, презентации, документация, видеозаписи и внешние ссылки
        </p>
      </div>
      <ProjectFilesManager projectId={project.id} initialFiles={project.files as any} readonly />
    </div>
  )

  // ── Stats tab ─────────────────────────────────────────────
  const statsContent = (
    <ProjectStatsTab
      viewCount={project.viewCount}
      searchHitCount={project.searchHitCount}
      createdAt={project.createdAt}
      updatedAt={project.updatedAt}
      status={project.status}
      launchDate={project.launchDate}
    />
  )

  return (
    <PageLayout>
      <Link href="/projects"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Все проекты
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={project.status} />
                <CategoryBadge category={project.category} />
                {project.isBestPractice && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Star size={11} className="fill-amber-500 text-amber-500" /> Лучший проект
                  </span>
                )}
                {project.isScalable && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                    <TrendingUp size={11} /> К тиражированию
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ShareButton title={project.title} />
                <Link href={`/admin/projects/${project.id}/edit`}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300">
                  <Pencil size={13} /> Редактировать
                </Link>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-800 mb-3">{project.title}</h1>

            <ProjectStats
              projectId={project.id}
              viewCount={project.viewCount}
              searchHitCount={project.searchHitCount}
            />
          </div>

          <ProjectTabs
            overview={overviewContent}
            passport={passportContent}
            files={filesContent}
            stats={statsContent}
          />
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="font-semibold text-slate-700 mb-4">Информация</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Building2 size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">Вуз</p>
                  <Link href={`/universities/${project.universityId}`}
                    className="font-medium text-blue-600 hover:underline">
                    {project.university.shortName || project.university.name}
                  </Link>
                  <p className="text-xs text-slate-400">{project.university.region.name}</p>
                </div>
              </div>
              {project.leadName && (
                <div className="flex items-start gap-2.5">
                  <User size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Руководитель</p>
                    <p className="font-medium text-slate-700">{project.leadName}</p>
                    {project.leadEmail && <p className="text-xs text-slate-400">{project.leadEmail}</p>}
                  </div>
                </div>
              )}
              {project.industry && (
                <div className="flex items-start gap-2.5">
                  <Layers size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Отрасль</p>
                    <p className="font-medium text-slate-700">{industryLabel(project.industry)}</p>
                  </div>
                </div>
              )}
              {project.implementedAt && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Где внедрено</p>
                    <p className="font-medium text-slate-700">{project.implementedAt}</p>
                  </div>
                </div>
              )}
              {project.teamSize && (
                <div className="flex items-center gap-2.5">
                  <Users size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Команда</p>
                    <p className="font-medium text-slate-700">{project.teamSize} человек</p>
                  </div>
                </div>
              )}
              {project.launchDate && (
                <div className="flex items-center gap-2.5">
                  <Calendar size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Дата запуска</p>
                    <p className="font-medium text-slate-700">{formatDateLong(project.launchDate)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {project.agentPassportPdf && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={12} /> Паспорт агента
              </p>
              <a href={project.agentPassportPdf} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline font-medium">
                Открыть PDF →
              </a>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
