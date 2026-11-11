import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { loadSearchIndex } from '@/lib/search/store'
import { searchIndex } from '@/lib/search/engine'
import { PageLayout } from '@/components/layout/PageLayout'
import { ProjectCard } from '@/components/ui/project-card'
import Link from 'next/link'
import { FolderKanban, Plus } from 'lucide-react'
import { ProjectCategory, ProjectStatus } from '@prisma/client'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/types'
import { requireUser } from '@/lib/auth'

async function getProjects(params: {
  q?: string; status?: string; category?: string; tech?: string; region?: string; topic?: string
}) {
  // Фильтры считает база, а текстовый запрос — смысловой движок поиска:
  // раньше здесь было совпадение подстроки по трём полям, из-за чего
  // «заводы» не находили «завод», а теги и технологии не искались вовсе.
  const projects = await prisma.project.findMany({
    where: {
      ...PUBLISHED_ONLY,
      ...(params.status ? { status: params.status as ProjectStatus } : {}),
      ...(params.category ? { category: params.category as ProjectCategory } : {}),
      ...(params.tech ? { technologies: { some: { slug: params.tech } } } : {}),
      ...(params.region ? { university: { region: { code: params.region.toUpperCase() } } } : {}),
      ...(params.topic ? { topics: { some: { topic: params.topic } } } : {}),
    },
    include: {
      university: { include: { region: true } },
      technologies: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!params.q?.trim()) return projects

  const index = await loadSearchIndex(prisma)
  const { hits } = searchIndex(index, params.q, { limit: 500 })
  const rank = new Map(hits.map((hit, position) => [hit.id, position]))

  return projects
    .filter(project => rank.has(project.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
}

async function getFilterOptions() {
  const [technologies, regions] = await Promise.all([
    prisma.technology.findMany({ orderBy: { name: 'asc' } }),
    prisma.region.findMany({
      where: { universities: { some: { projects: { some: PUBLISHED_ONLY } } } },
      orderBy: { name: 'asc' },
    }),
  ])
  return { technologies, regions }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; tech?: string; region?: string; topic?: string }>
}) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')

  const sp = await searchParams
  const [projects, { technologies, regions }] = await Promise.all([
    getProjects(sp),
    getFilterOptions(),
  ])

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ИИ-проекты</h1>
          <p className="text-slate-500 mt-1">{projects.length} проектов</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Добавить проект
        </Link>
      </div>

      <form className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Поиск..."
          className="col-span-2 md:col-span-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select name="status" defaultValue={sp.status || ''} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="category" defaultValue={sp.category || ''} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Все категории</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="tech" defaultValue={sp.tech || ''} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Все технологии</option>
          {technologies.map(t => <option key={t.id} value={t.slug}>{t.name}</option>)}
        </select>
        <select name="region" defaultValue={sp.region || ''} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.code.toLowerCase()}>{r.name}</option>)}
        </select>
        <button type="submit" className="col-span-2 md:col-span-1 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
          Применить
        </button>
        {Object.values(sp).some(Boolean) && (
          <Link href="/projects" className="col-span-2 md:col-span-1 text-center text-sm text-slate-400 hover:text-slate-600 py-2 border border-dashed border-slate-200 rounded-lg transition-colors">
            Сбросить фильтры
          </Link>
        )}
      </form>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => <ProjectCard key={project.id} project={project as any} />)}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl text-slate-400">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Проекты не найдены</p>
          <p className="text-sm mt-1">Попробуйте изменить параметры поиска</p>
        </div>
      )}
    </PageLayout>
  )
}
