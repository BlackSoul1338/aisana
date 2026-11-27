export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'
import { metaDescription } from '@/lib/seo'
import { PublicationStatus } from '@prisma/client'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'
import { technologyLabel } from '@/lib/technologies'
import { tagLabel } from '@/lib/tags'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const lang = await getRequestLang()
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
  const description = metaDescription(project.description, `${t('project', 'metaProject', lang)} ${uni}`)
  return {
    title: project.title,
    description,
    openGraph: { title: `${project.title} · ${uni}`, description },
  }
}
import { PageLayout } from '@/components/layout/PageLayout'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canAccessUniversity, requireUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import {
  ArrowLeft, Building2, User, Users, Calendar,
  Star, TrendingUp, Pencil, Mic, FileText, Layers, MapPin
} from 'lucide-react'
import { industryLabel } from '@/lib/industries'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { formatDateLong } from '@/lib/utils'
import { HearingDecision, UserRole } from '@prisma/client'
import { ProjectTabs } from '@/components/project/ProjectTabs'
import { AgentPassportViewer } from '@/components/project/AgentPassportViewer'
import { ProjectFilesManager } from '@/components/project/ProjectFilesManager'
import { ProjectStats } from '@/components/project/ProjectStats'
import { ProjectStatsTab } from '@/components/project/ProjectStatsTab'
import { ProjectTopics } from '@/components/project/ProjectTopics'
import { TOPICS } from '@/lib/search/taxonomy'
import { ShareButton } from '@/components/project/ShareButton'
import { SimilarProjects } from '@/components/project/SimilarProjects'
import { MarketAnalogs } from '@/components/project/MarketAnalogs'
import { ContactTeam } from '@/components/project/ContactTeam'
import { StartChat } from '@/components/business/StartChat'

const HEARING_COLORS: Record<HearingDecision, string> = {
  PENDING:     'bg-slate-100 text-slate-600',
  APPROVED:    'bg-emerald-100 text-emerald-700',
  REJECTED:    'bg-red-100 text-red-700',
  REVISION:    'bg-amber-100 text-amber-700',
  RECOMMENDED: 'bg-violet-100 text-violet-700',
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lang = await getRequestLang()

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
  const user = await requireUser('/')

  // Неопубликованные проекты доступны только в админ-панели:
  // просмотр и редактирование — на /admin/projects/[id]/edit
  if (!project || project.publication !== PublicationStatus.PUBLISHED) notFound()

  const topicLabels = Object.fromEntries(TOPICS.map(topic => [topic.id, lang === 'kz' ? topic.labelKz : topic.label]))

  // ── Overview tab ─────────────────────────────────────────
  const overviewContent = (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <p className="text-slate-600 leading-relaxed">{project.description}</p>
        {project.impact && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">{t('project', 'impact', lang)}</p>
            <p className="text-sm text-slate-700">{project.impact}</p>
          </div>
        )}
        {project.results && (
          <div className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">{t('project', 'results', lang)}</p>
            <p className="text-sm text-slate-700">{project.results}</p>
          </div>
        )}
      </div>

      {project.technologies.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-3">{t('project', 'technologies', lang)}</h2>
          <div className="flex flex-wrap gap-2">
            {project.technologies.map(tech => (
              <Link key={tech.id} href={`/projects?tech=${tech.slug}`}
                className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                {technologyLabel(tech, lang)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Заслушивания — внутренняя работа комиссии, бизнесу их не показываем */}
      {user.role !== UserRole.BUSINESS && (
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Mic size={16} className="text-slate-400" />
            {t('project', 'hearings', lang)} ({project.hearings.length})
          </h2>
          {canModerate(user) && (
            <Link href={`/admin/hearings/new?projectId=${project.id}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              {t('project', 'addHearing', lang)}
            </Link>
          )}
        </div>
        {project.hearings.length > 0 ? (
          <div className="space-y-3">
            {project.hearings.map(hearing => (
              <div key={hearing.id} className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-slate-700">{formatDateLong(hearing.date, lang)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEARING_COLORS[hearing.decision]}`}>
                    {t('hearings', hearing.decision, lang)}
                  </span>
                </div>
                {hearing.remarks && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">{t('hearings', 'remarks', lang)}: </span>{hearing.remarks}
                  </p>
                )}
                {hearing.recommendations && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-600">{t('hearings', 'recommendations', lang)}: </span>{hearing.recommendations}
                  </p>
                )}
                {hearing.commission.length > 0 && (
                  <p className="text-xs text-slate-400 mt-2">{t('hearings', 'commission', lang)}: {hearing.commission.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">{t('project', 'noHearings', lang)}</p>
        )}
      </div>
      )}

      <ProjectTopics topics={project.topics} labels={topicLabels} />

      <SimilarProjects projectId={project.id} />

      <MarketAnalogs projectId={project.id} />

      {project.tags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-700 mb-3">{t('project', 'tags', lang)}</h2>
          <div className="flex flex-wrap gap-2">
            {project.tags
              .map(tag => tagLabel(tag, lang))
              .filter((tag, i, all) => all.findIndex(t => t.toLocaleLowerCase('kk') === tag.toLocaleLowerCase('kk')) === i)
              .map(tag => (
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
          <h2 className="font-semibold text-slate-800">{t('project', 'passportTitle', lang)}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t('project', 'passportDesc', lang)}</p>
        </div>
      </div>
      <AgentPassportViewer projectId={project.id} initialUrl={project.agentPassportPdf} />
    </div>
  )

  // ── Files tab ─────────────────────────────────────────────
  const filesContent = (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="mb-5 pb-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">{t('project', 'filesTitle', lang)}</h2>
        <p className="text-xs text-slate-400 mt-1">
          {t('project', 'filesDesc', lang)}
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
        <ArrowLeft size={14} /> {t('project', 'allProjects', lang)}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={project.status} />
                <CategoryBadge category={project.category} />
                {project.isBestPractice && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Star size={11} className="fill-amber-500 text-amber-500" /> {t('project', 'bestBadge', lang)}
                  </span>
                )}
                {project.isScalable && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                    <TrendingUp size={11} /> {t('project', 'scalable', lang)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ShareButton title={project.title} />
                {canAccessUniversity(user, project.universityId) && (
                  <Link href={`/admin/projects/${project.id}/edit`}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 px-3 py-1.5 rounded-lg hover:border-blue-300">
                    <Pencil size={13} /> {t('common', 'edit', lang)}
                  </Link>
                )}
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
            <h2 className="font-semibold text-slate-700 mb-4">{t('project', 'info', lang)}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Building2 size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400">{t('project', 'university', lang)}</p>
                  <Link href={`/universities/${project.universityId}`}
                    className="font-medium text-blue-600 hover:underline">
                    {project.university.shortName || project.university.name}
                  </Link>
                  <p className="text-xs text-slate-400">{lang === 'kz' && project.university.region.nameKz ? project.university.region.nameKz : project.university.region.name}</p>
                </div>
              </div>
              {project.leadName && (
                <div className="flex items-start gap-2.5">
                  <User size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('project', 'lead', lang)}</p>
                    <p className="font-medium text-slate-700">{project.leadName}</p>
                    {project.leadEmail && user.role !== UserRole.BUSINESS && <p className="text-xs text-slate-400">{project.leadEmail}</p>}
                  </div>
                </div>
              )}
              {project.industry && (
                <div className="flex items-start gap-2.5">
                  <Layers size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('project', 'industry', lang)}</p>
                    <p className="font-medium text-slate-700">{industryLabel(project.industry, lang)}</p>
                  </div>
                </div>
              )}
              {project.implementedAt && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('project', 'implementedWhere', lang)}</p>
                    <p className="font-medium text-slate-700">{project.implementedAt}</p>
                  </div>
                </div>
              )}
              {project.teamSize && (
                <div className="flex items-center gap-2.5">
                  <Users size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('project', 'team', lang)}</p>
                    <p className="font-medium text-slate-700">{project.teamSize} {t('project', 'teamPeople', lang)}</p>
                  </div>
                </div>
              )}
              {project.launchDate && (
                <div className="flex items-center gap-2.5">
                  <Calendar size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">{t('project', 'launched', lang)}</p>
                    <p className="font-medium text-slate-700">{formatDateLong(project.launchDate, lang)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {user.role === UserRole.BUSINESS ? (
            <StartChat
              projectId={project.id}
              chatBasePath="/business/chats"
              title="Связаться с командой"
              hint="Напишите команде проекта: вопрос, демонстрация, пилот у себя. Ответ придёт в раздел «Диалоги»."
              placeholder="Что вас интересует: демонстрация, пилот у себя, совместная работа"
              buttonLabel="Написать команде"
            />
          ) : (
            <ContactTeam
              projectId={project.id}
              replyTo={user.email}
              defaultOrganization={user.university?.name}
            />
          )}

          {project.agentPassportPdf && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={12} /> {t('project', 'passportTitle', lang)}
              </p>
              <a href={project.agentPassportPdf} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline font-medium">
                {t('project', 'openPdf', lang)}
              </a>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
