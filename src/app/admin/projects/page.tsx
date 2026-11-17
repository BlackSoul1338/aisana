export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Prisma, ProjectStatus, PublicationStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { STATUS_LABELS } from '@/types'
import { ProjectsTable, type ProjectRow } from '@/components/admin/ProjectsTable'
import { DESCRIPTION_PLACEHOLDER, MIN_DESCRIPTION_LENGTH, isDescriptionEmpty } from '@/lib/project-completeness'
import { formatDate } from '@/lib/datetime'
import { ListFilters } from '@/components/admin/ListFilters'
import { Pagination } from '@/components/admin/Pagination'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZES = [50, 100]

const SORTS: Record<string, Prisma.ProjectOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  title: { title: 'asc' },
  // Очередь модерации: кто дольше ждёт, тот выше. Не отправлявшиеся — в конце.
  submitted: { submittedAt: { sort: 'asc', nulls: 'last' } },
}

interface SearchParams {
  q?: string
  universityId?: string
  regionId?: string
  status?: string
  publication?: string
  issue?: string
  size?: string
  sort?: string
  page?: string
}

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP], '/admin/projects')
  const lang = await getRequestLang()
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const PAGE_SIZE = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : DEFAULT_PAGE_SIZE
  const isRep = user.role === UserRole.UNIVERSITY_REP

  // ── where из фильтров ──────────────────────────────────────
  const where: Prisma.ProjectWhereInput = {
    // UNIVERSITY_REP всегда видит только свой вуз, фильтры это не обходят
    ...(isRep ? { universityId: user.universityId || '__none__' } : {}),
    ...(!isRep && params.universityId ? { universityId: params.universityId } : {}),
    ...(params.regionId ? { university: { regionId: params.regionId } } : {}),
    ...(params.status && params.status in STATUS_LABELS ? { status: params.status as ProjectStatus } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' } },
            { description: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  // Фильтр по статусу публикации: удобно открыть очередь «На проверке»
  if (params.publication && params.publication in PublicationStatus) {
    where.publication = params.publication as PublicationStatus
  }

  // Фильтр «что не так с карточкой». Пустое описание — это длина и заглушка
  // импорта (lib/project-completeness), в where Prisma так не выразить,
  // поэтому сначала берём id сырым запросом.
  if (params.issue === 'nodesc') {
    const empty = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM projects
      WHERE length(btrim(regexp_replace(description, '\\s+', ' ', 'g'))) < ${MIN_DESCRIPTION_LENGTH}
         OR btrim(description) ILIKE ${DESCRIPTION_PLACEHOLDER + '%'}`
    where.id = { in: empty.map(row => row.id) }
  } else if (params.issue === 'nofiles') {
    where.files = { none: {} }
    where.agentPassportPdf = null
  } else if (params.issue === 'noindustry') {
    where.industry = null
  } else if (params.issue === 'noplace') {
    where.status = { in: ['IMPLEMENTED', 'SCALED'] }
    where.implementedAt = null
  }

  const hasFilters = Boolean(params.q || params.universityId || params.regionId || params.status || params.publication || params.issue)

  const orderBy = SORTS[params.sort || 'newest'] || SORTS.newest

  const [projects, total, universities, regions] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        university: { select: { name: true, shortName: true } },
        technologies: { select: { name: true } },
        _count: { select: { files: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where }),
    isRep
      ? Promise.resolve([])
      : prisma.university.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { name: 'asc' } }),
    prisma.region.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const rows: ProjectRow[] = projects.map(project => ({
    id: project.id,
    title: project.title,
    snippet: project.description.replace(/\s+/g, ' ').trim().slice(0, 220),
    university: project.university.shortName || project.university.name,
    status: project.status,
    statusLabel: t('status', project.status, lang),
    publication: project.publication,
    technologies: project.technologies.map(t => t.name).join(', '),
    noDescription: isDescriptionEmpty(project.description),
    noFiles: project._count.files === 0 && !project.agentPassportPdf,
    dateLabel: project.publication === 'REVIEW' && project.submittedAt
      ? `${t('adminProjects', 'dateReview', lang)} ${formatDate(project.submittedAt)}`
      : `${t('adminProjects', 'dateCreated', lang)} ${formatDate(project.createdAt)}`,
  }))

  const filters = [
    ...(!isRep
      ? [{
          name: 'universityId',
          label: t('adminProjects', 'allUniversities', lang),
          options: universities.map(u => ({ value: u.id, label: u.shortName || u.name })),
        }]
      : []),
    {
      name: 'regionId',
      label: t('adminProjects', 'allRegions', lang),
      options: regions.map(r => ({ value: r.id, label: r.name })),
    },
    {
      name: 'status',
      label: t('adminProjects', 'allStatuses', lang),
      options: Object.keys(STATUS_LABELS).map(value => ({ value, label: t('status', value, lang) })),
    },
    {
      name: 'publication',
      label: t('adminProjects', 'allPublication', lang),
      options: [
        { value: 'REVIEW', label: t('adminProjects', 'pubReview', lang) },
        { value: 'DRAFT', label: t('adminProjects', 'pubDrafts', lang) },
        { value: 'PUBLISHED', label: t('adminProjects', 'pubPublished', lang) },
      ],
    },
    {
      name: 'issue',
      label: t('adminProjects', 'anyCompleteness', lang),
      options: [
        { value: 'nodesc', label: t('adminProjects', 'noDesc', lang) },
        { value: 'nofiles', label: t('adminProjects', 'noFiles', lang) },
        { value: 'noindustry', label: t('adminProjects', 'noIndustry', lang) },
        { value: 'noplace', label: t('adminProjects', 'noPlace', lang) },
      ],
    },
    {
      name: 'size',
      label: t('adminProjects', 'perPage', lang),
      options: PAGE_SIZES.map(size => ({ value: String(size), label: `${t('adminProjects', 'perPage', lang)}: ${size}` })),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">{t('admin', 'navProjects', lang)} ({total})</h1>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          {t('projects', 'addProject', lang)}
        </Link>
      </div>

      <ListFilters
        basePath="/admin/projects"
        values={params as Record<string, string | undefined>}
        filters={filters}
        searchPlaceholder={t('adminProjects', 'searchPlaceholder', lang)}
        sortOptions={[
          { value: 'newest', label: t('projects', 'sortNewest', lang) },
          { value: 'oldest', label: t('projects', 'sortOldest', lang) },
          { value: 'title', label: t('projects', 'sortTitle', lang) },
          { value: 'submitted', label: t('adminProjects', 'sortSubmitted', lang) },
        ]}
      />

      <ProjectsTable rows={rows} canModerate={canModerate(user)} />
      {projects.length === 0 && (
        <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-xl mt-3">
          {total === 0 && !hasFilters ? t('adminProjects', 'empty', lang) : t('adminProjects', 'nothingFound', lang)}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        basePath="/admin/projects"
        searchParams={params as Record<string, string | undefined>}
        totalLabel={t('common', 'total', lang)}
      />
    </div>
  )
}
