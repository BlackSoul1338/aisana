'use client'

import { useLang } from '@/context/LangContext'

interface RegionStat {
  name: string
  nameKz?: string | null
  universityCount: number
  projectCount: number
}

interface Props {
  x: number
  y: number
  region: RegionStat
}

export function MapTooltip({ x, y, region }: Props) {
  const { lang, t } = useLang()

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: x + 16, top: y - 10 }}
    >
      <div className="bg-white/95 border border-slate-200 dark:bg-[#0d1b3e]/95 dark:border-blue-400/30 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm min-w-[200px]">
        <p className="text-slate-800 dark:text-white font-semibold text-sm mb-0.5">
          {lang === 'kz' && region.nameKz ? region.nameKz : region.name}
        </p>
        {lang === 'ru' && region.nameKz && (
          <p className="text-slate-400 dark:text-white/40 text-xs mb-2">{region.nameKz}</p>
        )}
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between gap-6">
            <span className="text-slate-500 dark:text-white/60 text-xs">{t('home', 'tooltipUni')}</span>
            <span className="text-slate-800 dark:text-white font-medium text-xs tabular-nums">{region.universityCount}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-slate-500 dark:text-white/60 text-xs">{t('home', 'tooltipProj')}</span>
            <span className="text-blue-300 font-medium text-xs tabular-nums">{region.projectCount}</span>
          </div>
        </div>
        <p className="text-slate-400 dark:text-white/40 text-xs mt-2.5 border-t border-slate-200 dark:border-white/10 pt-2">
          {t('home', 'tooltipClick')}
        </p>
      </div>
    </div>
  )
}
