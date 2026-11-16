'use client'

import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Eye, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import { ProjectStatus, ProjectCategory } from '@prisma/client'
import { useLang } from '@/context/LangContext'
import { industryLabel } from '@/lib/industries'

const STATUS_ORDER: ProjectStatus[] = ['IDEA', 'PROTOTYPE', 'PILOT', 'IMPLEMENTED', 'SCALED']
const STATUS_COLORS: Record<ProjectStatus, string> = {
  IDEA: '#94a3b8', PROTOTYPE: '#f59e0b', PILOT: '#3b82f6',
  IMPLEMENTED: '#10b981', SCALED: '#8b5cf6',
}
const CATEGORY_COLORS: Record<ProjectCategory, string> = {
  EDUCATION: '#3b82f6', SCIENCE: '#8b5cf6', MANAGEMENT: '#f59e0b',
  ANALYTICS: '#10b981', GENERATIVE_AI: '#ec4899', COMPUTER_VISION: '#14b8a6', ROBOTICS: '#f97316',
}

interface Props {
  universityKpi: {
    target: number
    met: number
    notMet: number
    failing: { name: string; shortName: string; count: number; missing: number }[]
    withoutProjects: string[]
  }
  byRegion: { name: string; nameKz: string | null; count: number }[]
  byStatus: { status: string; count: number }[]
  byCategory: { category: string; count: number }[]
  stages: { status: string; total: number; confirmed: number; noDescription: number }[]
  byIndustry: { industry: string; count: number }[]
  technologies: { name: string; count: number }[]
  topViewed: { id: string; title: string; viewCount: number }[]
  topSearched: { id: string; title: string; searchHitCount: number }[]
  topUniversities: { name: string; shortName: string; count: number }[]
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="font-semibold text-slate-700">{title}</h2>
      {hint && <p className="text-xs text-slate-400 mt-0.5 mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </div>
  )
}

function TopProjectsList({ items, valueKey, icon: Icon, emptyText }: {
  items: { id: string; title: string; [k: string]: any }[]
  valueKey: string
  icon: any
  emptyText: string
}) {
  const max = items[0]?.[valueKey] || 1
  if (items.length === 0) return <p className="text-slate-400 text-sm py-4">{emptyText}</p>
  return (
    <div className="space-y-2.5">
      {items.map(p => (
        <Link key={p.id} href={`/projects/${p.id}`} className="block group">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-slate-700 truncate group-hover:text-blue-600 transition-colors">{p.title}</span>
            <span className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-1">
              <Icon size={12} className="text-slate-400" />{p[valueKey]}
            </span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-300 group-hover:bg-blue-400 rounded-full transition-colors"
              style={{ width: `${(p[valueKey] / max) * 100}%` }} />
          </div>
        </Link>
      ))}
    </div>
  )
}

export function DashboardCharts({
  universityKpi, byRegion, byStatus, byCategory, stages, byIndustry,
  technologies, topViewed, topSearched, topUniversities,
}: Props) {
  const { t, lang } = useLang()

  const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s.count]))
  const totalProjects = byStatus.reduce((s, x) => s + x.count, 0)
  const funnel = STATUS_ORDER.map(status => ({
    status,
    name: t('projects', status),
    count: statusMap[status] || 0,
    color: STATUS_COLORS[status],
  }))
  const funnelMax = Math.max(...funnel.map(f => f.count), 1)

  // Стадии: таблица с подтверждением. Порядок — как в воронке.
  const stageRows = STATUS_ORDER.map(status => {
    const found = stages.find(s => s.status === status)
    return {
      status,
      name: t('projects', status),
      color: STATUS_COLORS[status],
      total: found?.total ?? 0,
      confirmed: found?.confirmed ?? 0,
      noDescription: found?.noDescription ?? 0,
    }
  })
  const stageTotal = stageRows.reduce((sum, row) => sum + row.total, 0)
  const deployedRows = stageRows.filter(row => row.status === 'IMPLEMENTED' || row.status === 'SCALED')
  const deployed = deployedRows.reduce((sum, row) => sum + row.total, 0)
  const deployedConfirmed = deployedRows.reduce((sum, row) => sum + row.confirmed, 0)
  const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')

  // Отрасли: сначала заполненные по убыванию, «не указано» — последней строкой
  const industryRows = byIndustry
    .map(row => ({
      key: row.industry,
      name: row.industry === 'NONE' ? t('dashboard', 'industryNone') : industryLabel(row.industry, lang),
      count: row.count,
    }))
    .sort((a, b) => Number(a.key === 'NONE') - Number(b.key === 'NONE') || b.count - a.count)
  const industryMax = Math.max(...industryRows.filter(row => row.key !== 'NONE').map(row => row.count), 1)

  const categoryData = byCategory.map(c => ({
    name: t('projects', c.category),
    value: c.count,
    color: CATEGORY_COLORS[c.category as ProjectCategory] || '#94a3b8',
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* KPI вузов */}
      <ChartCard title={t('dashboard', 'uniKpi')} hint={t('dashboard', 'uniKpiHint')}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="text-emerald-600 mb-2"><CheckCircle2 size={20} /></div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{universityKpi.met}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">{t('dashboard', 'kpiMet')}</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <div className="text-red-600 mb-2"><XCircle size={20} /></div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{universityKpi.notMet}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-medium">{t('dashboard', 'kpiNotMet')}</div>
          </div>
        </div>
        {universityKpi.failing.length === 0 && universityKpi.withoutProjects.length === 0 ? (
          <p className="text-emerald-600 text-sm py-4 flex items-center gap-1.5">
            <CheckCircle2 size={15} />{t('dashboard', 'kpiAllMet')}
          </p>
        ) : (
          <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
            {universityKpi.failing.map(uni => (
              <div key={uni.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-slate-700 truncate">{uni.shortName}</span>
                  <span className="text-xs shrink-0">
                    <span className="font-semibold text-slate-600">{uni.count}</span>
                    <span className="text-red-600 font-medium ml-1.5">
                      ({t('dashboard', 'kpiMissing')} {uni.missing})
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${(uni.count / universityKpi.target) * 100}%` }} />
                </div>
              </div>
            ))}
            {universityKpi.withoutProjects.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
                  {t('dashboard', 'kpiNoProjects')}: <span className="font-semibold text-red-600">{universityKpi.withoutProjects.length}</span>
                </summary>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{universityKpi.withoutProjects.join(', ')}</p>
              </details>
            )}
          </div>
        )}
      </ChartCard>

      {/* Воронка зрелости (вместо пирога по статусам) */}
      <ChartCard title={t('dashboard', 'funnel')} hint={t('dashboard', 'funnelHint')}>
        <div className="space-y-3 pt-2">
          {funnel.map(f => (
            <div key={f.status} className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-28 shrink-0 text-right">{f.name}</span>
              <div className="flex-1 h-7 bg-slate-50 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md flex items-center px-2.5 min-w-fit transition-all"
                  style={{ width: `${(f.count / funnelMax) * 100}%`, backgroundColor: f.color }}
                >
                  <span className="text-[11px] font-semibold text-white whitespace-nowrap">
                    {f.count}
                    {totalProjects > 0 && f.count > 0 && (
                      <span className="opacity-75 ml-1">· {Math.round((f.count / totalProjects) * 100)}%</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Стадии с подтверждением */}
      <ChartCard title={t('dashboard', 'stages')} hint={t('dashboard', 'stagesHint')}>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100">
              <th className="text-left font-medium py-2">{t('dashboard', 'stageCol')}</th>
              <th className="text-right font-medium py-2">{t('dashboard', 'stageTotal')}</th>
              <th className="text-right font-medium py-2">{t('dashboard', 'stageShare')}</th>
              <th className="text-right font-medium py-2">{t('dashboard', 'stageConfirmed')}</th>
              <th className="text-right font-medium py-2">{t('dashboard', 'stageNoDescription')}</th>
            </tr>
          </thead>
          <tbody>
            {stageRows.map(row => (
              <tr key={row.status} className="border-b border-slate-50">
                <td className="py-2 text-slate-700">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ backgroundColor: row.color }} />
                  <Link href={`/projects?status=${row.status}`} className="hover:text-blue-600 hover:underline">{row.name}</Link>
                </td>
                <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">{row.total}</td>
                <td className="py-2 text-right text-slate-500 tabular-nums">{share(row.total, stageTotal)}</td>
                <td className="py-2 text-right text-slate-700 tabular-nums">{row.confirmed}</td>
                <td className={`py-2 text-right tabular-nums ${row.noDescription > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>{row.noDescription}</td>
              </tr>
            ))}
            <tr className="font-semibold text-slate-800">
              <td className="py-2">{t('dashboard', 'stageSum')}</td>
              <td className="py-2 text-right tabular-nums">{stageTotal}</td>
              <td className="py-2 text-right tabular-nums">{stageTotal > 0 ? '100%' : '—'}</td>
              <td className="py-2 text-right tabular-nums">{stageRows.reduce((sum, row) => sum + row.confirmed, 0)}</td>
              <td className="py-2 text-right tabular-nums">{stageRows.reduce((sum, row) => sum + row.noDescription, 0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-slate-500 mt-3">
          {t('dashboard', 'deployedLine')}: <span className="font-semibold text-slate-700">{deployed}</span>,{' '}
          {t('dashboard', 'deployedConfirmed')}: <span className="font-semibold text-slate-700">{deployedConfirmed}</span>
        </p>
      </ChartCard>

      {/* Отрасли применения */}
      <ChartCard title={t('dashboard', 'byIndustry')} hint={t('dashboard', 'byIndustryHint')}>
        <div className="space-y-2 pt-2">
          {industryRows.map(row => (
            <div key={row.key} className="flex items-center gap-3">
              <Link href={`/projects?industry=${row.key}`} className={`text-xs w-56 shrink-0 text-right hover:text-blue-600 hover:underline ${row.key === 'NONE' ? 'text-slate-400 italic' : 'text-slate-600'}`}>{row.name}</Link>
              <div className="flex-1 h-5 bg-slate-50 rounded overflow-hidden">
                {row.key !== 'NONE' && (
                  <div className="h-full bg-blue-500 rounded" style={{ width: `${(row.count / industryMax) * 100}%` }} />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700 w-10 tabular-nums">{row.count}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Проекты по регионам */}
      <ChartCard title={t('dashboard', 'byRegion')}>
        {/*
          Высота считается от числа регионов, а подписи выводятся все (interval={0}).
          При фиксированной высоте Recharts сам прореживал ось и часть регионов
          оставалась без названия — выглядело как пропавшие данные.
        */}
        <ResponsiveContainer width="100%" height={Math.max(300, byRegion.length * 26 + 40)}>
          <BarChart data={byRegion} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={170} interval={0} tick={{ fontSize: 11 }}
              tickFormatter={v => v.length > 19 ? v.slice(0, 18) + '…' : v} />
            <Tooltip />
            <Bar dataKey="count" fill="#1A56DB" radius={[0, 4, 4, 0]} name={t('dashboard', 'projects')} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Популярные технологии */}
      <ChartCard title={t('dashboard', 'technologies')}>
        {technologies.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">{t('dashboard', 'noData')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, technologies.length * 30 + 40)}>
            <BarChart data={technologies} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} interval={0} tick={{ fontSize: 11 }}
                tickFormatter={v => v.length > 18 ? v.slice(0, 17) + '…' : v} />
              <Tooltip />
              <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} name={t('dashboard', 'projects')} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Проекты по категориям */}
      <ChartCard title={t('dashboard', 'byCategory')}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name={t('dashboard', 'projects')} radius={[4, 4, 0, 0]}>
              {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Топ вузов */}
      <ChartCard title={t('dashboard', 'topUni')}>
        <div className="space-y-3">
          {topUniversities.slice(0, 8).map((uni, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-slate-700 truncate">{uni.shortName}</span>
                  <span className="text-xs font-semibold text-slate-600 shrink-0">{uni.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(uni.count / (topUniversities[0]?.count || 1)) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
          {topUniversities.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8">{t('dashboard', 'noData')}</p>
          )}
        </div>
      </ChartCard>

      {/* Интерес аудитории */}
      <ChartCard title={t('dashboard', 'audience')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
              <Eye size={13} />{t('dashboard', 'topViewed')}
            </p>
            <TopProjectsList items={topViewed} valueKey="viewCount" icon={Eye} emptyText={t('dashboard', 'noData')} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles size={13} />{t('dashboard', 'topSearched')}
            </p>
            <TopProjectsList items={topSearched} valueKey="searchHitCount" icon={Sparkles} emptyText={t('dashboard', 'noData')} />
          </div>
        </div>
      </ChartCard>
    </div>
  )
}
