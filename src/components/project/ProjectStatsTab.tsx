'use client'

import { Eye, Search, TrendingUp, Calendar } from 'lucide-react'
import { formatDateLong } from '@/lib/utils'
import { useLang } from '@/context/LangContext'

interface Props {
  viewCount: number
  searchHitCount: number
  createdAt: Date | string
  updatedAt: Date | string
  status: string
  launchDate?: Date | string | null
}

export function ProjectStatsTab({ viewCount, searchHitCount, createdAt, updatedAt, status, launchDate }: Props) {
  const { t, lang } = useLang()
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Eye,       label: t('project', 'statViews'),       value: viewCount,       color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { icon: Search,    label: t('project', 'statAiHits'), value: searchHitCount,  color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} rounded-xl p-5 border border-slate-100`}>
            <item.icon size={20} className={`${item.color} mb-2`} />
            <div className="text-3xl font-bold text-slate-800 tabular-nums">{item.value}</div>
            <div className="text-xs text-slate-500 mt-1">{item.label}</div>
          </div>
        ))}

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <Calendar size={20} className="text-slate-400 mb-2" />
          <div className="text-sm font-semibold text-slate-700">{t('project', 'statAdded')}</div>
          <div className="text-xs text-slate-500 mt-1">{formatDateLong(createdAt, lang)}</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
          <TrendingUp size={20} className="text-slate-400 mb-2" />
          <div className="text-sm font-semibold text-slate-700">{t('project', 'statUpdated')}</div>
          <div className="text-xs text-slate-500 mt-1">{formatDateLong(updatedAt, lang)}</div>
        </div>
      </div>

      {launchDate && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('project', 'timeline')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div className="w-0.5 h-8 bg-slate-200" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400">{t('project', 'projectLaunch')}</p>
                <p className="text-sm font-medium text-slate-700">{formatDateLong(launchDate, lang)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t('project', 'currentStatus')}</p>
                <p className="text-sm font-medium text-slate-700">{t('status', status)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        {t('project', 'statsNote')}
      </div>
    </div>
  )
}
