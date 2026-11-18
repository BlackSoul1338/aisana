'use client'

import { useLang } from '@/context/LangContext'
import { MAP_SCALE } from './map-scale'

interface Props {
  stats: { totalUniversities: number; totalProjects: number }
}

export function MapOverlay({ stats }: Props) {
  const { t } = useLang()

  return (
    <>
      {/*
        Верх карты.
        На узких экранах — обычная колонка: заголовок, под ним счётчики,
        иначе плашки наезжали на текст. От sm и шире — прежняя раскладка:
        счётчики слева, заголовок по центру.
        pointer-events-none, чтобы блок не перехватывал клики по карте.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:p-0">
        <div className="flex flex-col items-center gap-3 sm:block">

          {/* Заголовок */}
          <div className="max-w-[22rem] text-center sm:absolute sm:left-1/2 sm:top-4 sm:max-w-none sm:-translate-x-1/2">
            <p className="text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-600 dark:text-white/60 sm:text-xs sm:tracking-[0.2em]">
              {t('home', 'ministry')}
            </p>
            <h1 className="mt-0.5 text-base font-bold tracking-wide text-slate-900 dark:text-white sm:mt-1 sm:text-lg">
              {t('home', 'title')}
            </h1>
          </div>

          {/* Счётчики */}
          <div className="flex gap-2 sm:absolute sm:left-4 sm:top-4 sm:gap-3">
            {[
              { label: t('home', 'universities'), value: stats.totalUniversities, color: 'from-blue-500 to-blue-700' },
              { label: t('home', 'aiProjects'), value: stats.totalProjects, color: 'from-violet-500 to-violet-700' },
            ].map(stat => (
              <div
                key={stat.label}
                className={`bg-gradient-to-br ${stat.color} rounded-xl border border-white/10 px-3.5 py-2 text-white shadow-lg backdrop-blur-sm sm:px-5 sm:py-3`}
              >
                <div className="text-xl font-bold tabular-nums leading-tight sm:text-2xl">{stat.value}</div>
                <div className="mt-0.5 text-[11px] font-medium leading-tight text-white/80 sm:text-xs">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда: на мобильных компактнее и в два столбца, чтобы не занимать пол-экрана */}
      <div className="pointer-events-none absolute bottom-4 right-3 z-20 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-white/10 dark:bg-[#0d1b3e]/90 dark:shadow-none sm:bottom-6 sm:right-4 sm:p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/70 sm:mb-3 sm:text-xs">
          {t('home', 'legendTitle')}
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-1 sm:gap-2">
          {MAP_SCALE.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-sm border border-slate-300 dark:border-white/20 sm:h-4 sm:w-4"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] font-medium text-slate-700 dark:text-white/80 sm:text-xs">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
