'use client'

import { Building2, FolderKanban, CheckCircle, Clock, Users, Award, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/context/LangContext'

interface Props {
  kpi: {
    totalUniversities: number
    universitiesWithProjects: number
    totalProjects: number
    implementedProjects: number
    inProgressProjects: number
    teamMembers: number
    teamProjects: number
    bestPractices: number
  }
}

export function DashboardKPI({ kpi }: Props) {
  const { t } = useLang()

  // href — куда ведёт карточка: число на дашборде должно открываться списком.
  // note — уточнение под подписью, когда число без него читается неверно.
  const cards = [
    { key: 'uniWithProjects', value: kpi.universitiesWithProjects, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100',
      href: '/universities?has=projects', note: `${t('dashboard', 'ofConnected')} ${kpi.totalUniversities}` },
    { key: 'totalProj', value: kpi.totalProjects, icon: FolderKanban, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100',
      href: '/projects', note: '' },
    { key: 'implemented', value: kpi.implementedProjects, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100',
      href: '/projects?status=DEPLOYED', note: t('dashboard', 'implementedNote') },
    { key: 'inProgress', value: kpi.inProgressProjects, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100',
      href: '/projects?status=IN_PROGRESS', note: t('dashboard', 'inProgressNote') },
    { key: 'teamMembers', value: kpi.teamMembers, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100',
      href: '', note: `${t('dashboard', 'teamNote')} ${kpi.teamProjects} ${t('dashboard', 'teamNoteOf')} ${kpi.totalProjects}` },
    { key: 'bestPractices', value: kpi.bestPractices, icon: Award, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-100',
      href: '/best-practices', note: '' },
  ]

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('dashboard', 'title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboard', 'subtitle')}</p>
        </div>
        <a
          href="/api/export/dashboard"
          download
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shrink-0"
        >
          <FileSpreadsheet size={16} />
          {t('dashboard', 'exportExcel')}
        </a>
      </div>
      <div className="mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(card => {
          const body = (
            <>
              <div className={`${card.color} mb-3`}><card.icon size={22} /></div>
              <div className="text-3xl font-bold text-slate-800 tabular-nums">{card.value}</div>
              <div className="text-xs text-slate-500 mt-1 font-medium">{t('dashboard', card.key)}</div>
              {card.note && <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{card.note}</div>}
            </>
          )
          const cls = `${card.bg} ${card.border} border rounded-xl p-5 block`
          return card.href
            ? <Link key={card.key} href={card.href} className={`${cls} hover:shadow-md transition-shadow`}>{body}</Link>
            : <div key={card.key} className={cls}>{body}</div>
        })}
      </div>
    </div>
  )
}
