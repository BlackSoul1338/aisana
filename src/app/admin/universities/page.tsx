export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { ExternalLink, Plus, Pencil } from 'lucide-react'
import { Prisma, UniversityType, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { DeleteUniversityButton } from './DeleteButton'
import { ListFilters } from '@/components/admin/ListFilters'
import { Pagination } from '@/components/admin/Pagination'

const PAGE_SIZE = 25

const TYPE_LABELS: Record<UniversityType, string> = {
  STATE: 'Государственный',
  PRIVATE: 'Частный',
  NATIONAL: 'Национальный',
  RESEARCH: 'Исследовательский',
}

interface SearchParams {
  q?: string
  regionId?: string
  type?: string
  sort?: string
  page?: string
}

export default async function AdminUniversitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/universities')
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)

  const where: Prisma.UniversityWhereInput = {
    ...(params.regionId ? { regionId: params.regionId } : {}),
    ...(params.type && params.type in TYPE_LABELS ? { type: params.type as UniversityType } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { nameKz: { contains: params.q, mode: 'insensitive' } },
            { shortName: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const orderBy: Prisma.UniversityOrderByWithRelationInput =
    params.sort === 'projects' ? { projects: { _count: 'desc' } } : { name: 'asc' }

  const [universities, total, regions] = await Promise.all([
    prisma.university.findMany({
      where,
      include: { region: true, _count: { select: { projects: true } } },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.university.count({ where }),
    prisma.region.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Вузы ({total})</h1>
        <Link
          href="/admin/universities/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          Добавить вуз
        </Link>
      </div>

      <ListFilters
        basePath="/admin/universities"
        values={params as Record<string, string | undefined>}
        filters={[
          { name: 'regionId', label: 'Все регионы', options: regions.map(r => ({ value: r.id, label: r.name })) },
          { name: 'type', label: 'Все типы', options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
        ]}
        searchPlaceholder="Поиск по названию…"
        sortOptions={[
          { value: 'name', label: 'По названию А-Я' },
          { value: 'projects', label: 'По числу проектов' },
        ]}
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Вуз</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Регион</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Тип</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">Проекты</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {universities.map(uni => (
              <tr key={uni.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    {uni.shortName && <span className="text-xs font-semibold text-blue-600 mr-2">{uni.shortName}</span>}
                    <span className="text-slate-800 font-medium">{uni.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{uni.region.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{TYPE_LABELS[uni.type]}</td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-slate-700">{uni._count.projects}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`/universities/${uni.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Открыть на сайте"
                      className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <Link
                      href={`/admin/universities/${uni.id}/edit`}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil size={12} />
                      Изменить
                    </Link>
                    <DeleteUniversityButton id={uni.id} name={uni.shortName || uni.name} projectCount={uni._count.projects} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {universities.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            {total === 0 && !params.q && !params.regionId && !params.type
              ? 'Нет вузов'
              : 'Ничего не найдено по заданным фильтрам'}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        basePath="/admin/universities"
        searchParams={params as Record<string, string | undefined>}
      />
    </div>
  )
}
