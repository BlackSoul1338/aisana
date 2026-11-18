import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { loadSearchIndex } from '@/lib/search/store'
import { searchIndex } from '@/lib/search/engine'
import { PageLayout } from '@/components/layout/PageLayout'
import { ProjectCard } from '@/components/ui/project-card'
import { AutoSubmitForm } from '@/components/ui/AutoSubmitForm'
import { Pagination } from '@/components/admin/Pagination'
import Link from 'next/link'
import { FolderKanban, Plus } from 'lucide-react'
import { Prisma, ProjectCategory, ProjectIndustry, ProjectStatus } from '@prisma/client'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/types'
import { INDUSTRIES } from '@/lib/industries'
import { plural } from '@/lib/plural'
import { canWriteContent, requireUser } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const PAGE_SIZE = 24

interface Params {
  q?: string; status?: string; category?: string; tech?: string; region?: string; topic?: string
  university?: string; industry?: string; sort?: string; page?: string
}

/**
 * Группы стадий для ссылок с дашборда: «Внедрено» там — это внедрено и
 * масштабировано вместе, «В разработке» — прототип и пилот.
 */
const STATUS_GROUPS: Record<string, { key: string; statuses: ProjectStatus[] }> = {
  DEPLOYED: { key: 'statusGroupDeployed', statuses: ['IMPLEMENTED', 'SCALED'] },
  IN_PROGRESS: { key: 'statusGroupInProgress', statuses: ['PROTOTYPE', 'PILOT'] },
}

const SORTS: Record<string, { key: string; orderBy: Prisma.ProjectOrderByWithRelationInput }> = {
  newest: { key: 'sortNewest', orderBy: { createdAt: 'desc' } },
  oldest: { key: 'sortOldest', orderBy: { createdAt: 'asc' } },
  title: { key: 'sortTitle', orderBy: { title: 'asc' } },
  views: { key: 'sortViews', orderBy: { viewCount: 'desc' } },
}

function buildWhere(params: Params): Prisma.ProjectWhereInput {
  const status = params.status
  return {
    ...PUBLISHED_ONLY,
    ...(status && status in STATUS_GROUPS ? { status: { in: STATUS_GROUPS[status].statuses } } : {}),
    ...(status && status in STATUS_LABELS ? { status: status as ProjectStatus } : {}),
    ...(params.category && params.category in CATEGORY_LABELS ? { category: params.category as ProjectCategory } : {}),
    ...(params.industry === 'NONE' ? { industry: null } : {}),
    ...(params.industry && INDUSTRIES.some(i => i.value === params.industry) ? { industry: params.industry as ProjectIndustry } : {}),
    ...(params.tech ? { technologies: { some: { slug: params.tech } } } : {}),
    ...(params.region ? { university: { region: { code: params.region.toUpperCase() } } } : {}),
    ...(params.university ? { universityId: params.university } : {}),
    ...(params.topic ? { topics: { some: { topic: params.topic } } } : {}),
  }
}

const INCLUDE = { university: { include: { region: true } }, technologies: true } satisfies Prisma.ProjectInclude

/**
 * Одна страница проектов и общее число найденных.
 *
 * Раньше страница отдавала все проекты разом — почти девятьсот карточек.
 * Фильтры считает база. Текстовый запрос обрабатывает смысловой движок
 * поиска: он ранжирует все подходящие id, а полные записи достаются только
 * для текущей страницы.
 */
async function getProjects(params: Params, page: number) {
  const where = buildWhere(params)
  const sort = SORTS[params.sort || '']

  if (!params.q?.trim()) {
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where, include: INCLUDE,
        orderBy: (sort || SORTS.newest).orderBy,
        skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      }),
      prisma.project.count({ where }),
    ])
    return { projects, total }
  }

  const [candidates, index] = await Promise.all([
    prisma.project.findMany({ where, select: { id: true }, orderBy: (sort || SORTS.newest).orderBy }),
    loadSearchIndex(prisma),
  ])
  const { hits } = searchIndex(index, params.q, { limit: 1000 })
  const rank = new Map(hits.map((hit, position) => [hit.id, position]))
  let ids = candidates.map(c => c.id).filter(id => rank.has(id))
  // Без явной сортировки — по релевантности; с ней — порядок из базы
  if (!sort) ids = ids.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))

  const pageIds = ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const found = await prisma.project.findMany({ where: { id: { in: pageIds } }, include: INCLUDE })
  const byId = new Map(found.map(project => [project.id, project]))
  return { projects: pageIds.flatMap(id => byId.get(id) ?? []), total: ids.length }
}

async function getFilterOptions() {
  const [technologies, regions, universities] = await Promise.all([
    prisma.technology.findMany({
      where: { projects: { some: PUBLISHED_ONLY } },
      orderBy: { name: 'asc' },
    }),
    prisma.region.findMany({
      where: { universities: { some: { projects: { some: PUBLISHED_ONLY } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.university.findMany({
      where: { projects: { some: PUBLISHED_ONLY } },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return { technologies, regions, universities }
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Params> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  const user = await requireUser('/')
  const lang = await getRequestLang()

  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const [{ projects, total }, { technologies, regions, universities }] = await Promise.all([
    getProjects(sp, page),
    getFilterOptions(),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Object.entries(sp).some(([key, value]) => key !== 'page' && Boolean(value))

  const select = 'border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-0'

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('projects', 'title', lang)}</h1>
          <p className="text-slate-500 mt-1">
            {hasFilters ? `${t('projects', 'found', lang)}: ` : ''}{total} {lang === 'kz' ? 'жоба' : plural(total, 'проект', 'проекта', 'проектов')}
            {sp.q?.trim() ? <> {t('projects', 'forQuery', lang)} «{sp.q.trim()}»</> : null}
          </p>
        </div>
        {canWriteContent(user) && (
          <Link
            href="/admin/projects/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            {t('projects', 'addProject', lang)}
          </Link>
        )}
      </div>

      <AutoSubmitForm className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder={t('projects', 'searchPlaceholder', lang)}
          className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select name="status" defaultValue={sp.status || ''} className={select}>
          <option value="">{t('projects', 'allStages', lang)}</option>
          {Object.keys(STATUS_LABELS).map(k => <option key={k} value={k}>{t('status', k, lang)}</option>)}
          {Object.entries(STATUS_GROUPS).map(([k, v]) => <option key={k} value={k}>{t('projects', v.key, lang)}</option>)}
        </select>
        <select name="industry" defaultValue={sp.industry || ''} className={select}>
          <option value="">{t('projects', 'allIndustries', lang)}</option>
          {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i[lang]}</option>)}
          <option value="NONE">{t('projects', 'industryNone', lang)}</option>
        </select>
        <select name="category" defaultValue={sp.category || ''} className={select}>
          <option value="">{t('projects', 'allCategories', lang)}</option>
          {Object.keys(CATEGORY_LABELS).map(k => <option key={k} value={k}>{t('category', k, lang)}</option>)}
        </select>
        <select name="university" defaultValue={sp.university || ''} className={select}>
          <option value="">{t('projects', 'allUniversities', lang)}</option>
          {universities.map(u => <option key={u.id} value={u.id}>{u.shortName ? `${u.shortName} - ${u.name}` : u.name}</option>)}
        </select>
        <select name="region" defaultValue={sp.region || ''} className={select}>
          <option value="">{t('projects', 'allRegions', lang)}</option>
          {regions.map(r => <option key={r.id} value={r.code.toLowerCase()}>{lang === 'kz' && r.nameKz ? r.nameKz : r.name}</option>)}
        </select>
        <select name="tech" defaultValue={sp.tech || ''} className={select}>
          <option value="">{t('projects', 'allTech', lang)}</option>
          {technologies.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}
        </select>
        <select name="sort" defaultValue={sp.sort || ''} className={select}>
          <option value="">{sp.q?.trim() ? t('projects', 'relevant', lang) : t('projects', 'sortNewest', lang)}</option>
          {Object.entries(SORTS)
            .filter(([key]) => sp.q?.trim() || key !== 'newest')
            .map(([key, sort]) => <option key={key} value={key}>{t('projects', sort.key, lang)}</option>)}
        </select>
        {/* Тематическое направление приходит по ссылке с карточки проекта — сохраняем его при смене фильтров */}
        {sp.topic && <input type="hidden" name="topic" value={sp.topic} />}
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
          {t('projects', 'apply', lang)}
        </button>
        {hasFilters && (
          <Link href="/projects" className="text-center text-sm text-slate-400 hover:text-slate-600 py-2 border border-dashed border-slate-200 rounded-lg transition-colors">
            {t('common', 'reset', lang)}
          </Link>
        )}
      </AutoSubmitForm>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => <ProjectCard key={project.id} project={project as any} lang={lang} />)}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl text-slate-400">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{t('projects', 'notFound', lang)}</p>
          <p className="text-sm mt-1">{t('projects', 'tryAdjust', lang)}</p>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        basePath="/projects"
        searchParams={sp as Record<string, string | undefined>}
        totalLabel={t('common', 'total', lang)}
      />
    </PageLayout>
  )
}
