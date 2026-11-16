import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { PageLayout } from '@/components/layout/PageLayout'
import { AutoSubmitForm } from '@/components/ui/AutoSubmitForm'
import { Pagination } from '@/components/admin/Pagination'
import Link from 'next/link'
import { Building2, FolderKanban, MapPin, ExternalLink, Plus } from 'lucide-react'
import { Prisma, UniversityType } from '@prisma/client'
import { plural } from '@/lib/plural'
import { requireUser } from '@/lib/auth'

const PAGE_SIZE = 24

const TYPE_LABELS: Record<UniversityType, string> = {
  NATIONAL: 'Национальный',
  RESEARCH: 'Исследовательский',
  STATE: 'Государственный',
  PRIVATE: 'Частный',
}

interface Params { region?: string; q?: string; has?: string; type?: string; sort?: string; page?: string }

function buildWhere({ q, region, has, type }: Params): Prisma.UniversityWhereInput {
  return {
    ...(region ? { region: { code: region.toUpperCase() } } : {}),
    ...(type && type in TYPE_LABELS ? { type: type as UniversityType } : {}),
    ...(has === 'projects' ? { projects: { some: PUBLISHED_ONLY } } : {}),
    ...(has === 'none' ? { projects: { none: PUBLISHED_ONLY } } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { nameKz: { contains: q, mode: 'insensitive' } },
        { shortName: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
  }
}

/** Сокращение вуза: чем длиннее, тем мельче шрифт — чтобы не рвалось посреди слова. */
function shortNameClass(text: string): string {
  if (text.length <= 5) return 'text-sm'
  if (text.length <= 8) return 'text-xs'
  return 'text-[10px]'
}

export default async function UniversitiesPage({ searchParams }: { searchParams: Promise<Params> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const where = buildWhere(sp)

  const [universities, total, totalAll, withProjects, regions] = await Promise.all([
    prisma.university.findMany({
      where,
      include: {
        region: true,
        _count: { select: { projects: { where: PUBLISHED_ONLY } } },
      },
      orderBy: sp.sort === 'name' ? [{ name: 'asc' }] : [{ projects: { _count: 'desc' } }, { name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.university.count({ where }),
    prisma.university.count(),
    prisma.university.count({ where: { projects: { some: PUBLISHED_ONLY } } }),
    prisma.region.findMany({ orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(sp.q || sp.region || sp.has || sp.type)

  const select = 'border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-0'

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Вузы</h1>
          <p className="text-slate-500 mt-1">
            {hasFilters
              ? <>Найдено: {total} {plural(total, 'вуз', 'вуза', 'вузов')}</>
              : <>{totalAll} {plural(totalAll, 'вуз', 'вуза', 'вузов')}, с проектами: {withProjects}</>}
          </p>
        </div>
        <Link href="/admin/universities/new" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Добавить вуз
        </Link>
      </div>

      <AutoSubmitForm className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <input
          name="q"
          defaultValue={sp.q}
          placeholder="Поиск по названию..."
          className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select name="region" defaultValue={sp.region || ''} className={select}>
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.code.toLowerCase()}>{r.name}</option>)}
        </select>
        <select name="has" defaultValue={sp.has || ''} className={select}>
          <option value="">Все вузы</option>
          <option value="projects">Только с проектами</option>
          <option value="none">Без проектов</option>
        </select>
        <select name="type" defaultValue={sp.type || ''} className={select}>
          <option value="">Все типы</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="sort" defaultValue={sp.sort || ''} className={select}>
          <option value="">По числу проектов</option>
          <option value="name">По названию А-Я</option>
        </select>
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
          Найти
        </button>
        {(hasFilters || sp.sort) && (
          <Link href="/universities" className="text-center text-sm text-slate-400 hover:text-slate-600 py-2 border border-dashed border-slate-200 rounded-lg transition-colors">
            Сбросить фильтры
          </Link>
        )}
      </AutoSubmitForm>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {universities.map(uni => {
          const short = uni.shortName
            || uni.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 6)
          return (
            <Link key={uni.id} href={`/universities/${uni.id}`}>
              <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all h-full">
                <div className="flex items-start gap-3 mb-4">
                  <div className="shrink-0 w-[4.5rem] text-center pt-0.5">
                    <span className={`text-blue-600 font-bold leading-tight block break-words ${shortNameClass(short)}`}>
                      {short}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 border-l border-slate-100 pl-3">
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{uni.name}</h3>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} /><span>{uni.region.name}</span>
                  </div>
                  {uni.website && (
                    <div className="flex items-center gap-1.5">
                      <ExternalLink size={12} /><span className="truncate">{uni.website.replace(/^https?:\/\//, '')}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <FolderKanban size={13} className={uni._count.projects > 0 ? 'text-blue-500' : 'text-slate-300'} />
                    {uni._count.projects > 0 ? (
                      <>
                        <span className="font-semibold text-slate-700">{uni._count.projects}</span>
                        <span className="text-slate-400">{plural(uni._count.projects, 'проект', 'проекта', 'проектов')}</span>
                      </>
                    ) : (
                      <span className="text-slate-400">нет проектов</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border">
                    {TYPE_LABELS[uni.type]}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {universities.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Вузы не найдены</p>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        basePath="/universities"
        searchParams={sp as Record<string, string | undefined>}
      />
    </PageLayout>
  )
}
