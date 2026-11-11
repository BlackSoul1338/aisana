import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { PageLayout } from '@/components/layout/PageLayout'
import Link from 'next/link'
import { Building2, FolderKanban, MapPin, ExternalLink, Plus } from 'lucide-react'
import { requireUser } from '@/lib/auth'

async function getUniversities(q?: string, region?: string) {
  return prisma.university.findMany({
    where: {
      ...(region ? { region: { code: region.toUpperCase() } } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { shortName: { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: {
      region: true,
      _count: { select: { projects: { where: PUBLISHED_ONLY } } },
    },
    orderBy: [{ projects: { _count: 'desc' } }, { name: 'asc' }],
  })
}

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; q?: string }>
}) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  await requireUser('/')
  const { region, q } = await searchParams
  const [universities, regions] = await Promise.all([
    getUniversities(q, region),
    prisma.region.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Вузы</h1>
          <p className="text-slate-500 mt-1">{universities.length} университетов</p>
        </div>
        <Link href="/admin/universities/new" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Добавить вуз
        </Link>
      </div>

      <form className="flex gap-3 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Поиск по названию..."
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <select name="region" defaultValue={region || ''} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.code.toLowerCase()}>{r.name}</option>)}
        </select>
        <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors">
          Найти
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {universities.map(uni => (
          <Link key={uni.id} href={`/universities/${uni.id}`}>
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all h-full">
              <div className="flex items-start gap-3 mb-4">
                {/* Abbreviation instead of colored square */}
                <div className="shrink-0 w-14 text-center pt-0.5">
                  <span className="text-blue-600 font-bold text-sm leading-tight block break-all">
                    {uni.shortName
                      ? uni.shortName
                      : uni.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 6)}
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
                    <ExternalLink size={12} /><span className="truncate">{uni.website.replace('https://', '')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  <FolderKanban size={13} className="text-blue-500" />
                  <span className="font-semibold text-slate-700">{uni._count.projects}</span>
                  <span className="text-slate-400">проектов</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border">
                  {uni.type === 'NATIONAL' ? 'Национальный' : uni.type === 'RESEARCH' ? 'Исследовательский' : uni.type === 'PRIVATE' ? 'Частный' : 'Государственный'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {universities.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Вузы не найдены</p>
        </div>
      )}
    </PageLayout>
  )
}
