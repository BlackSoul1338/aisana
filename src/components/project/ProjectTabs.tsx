'use client'

import { useState } from 'react'
import { FileText, Bot, Paperclip, BarChart2 } from 'lucide-react'
import { useLang } from '@/context/LangContext'

const TABS = [
  { id: 'overview',  key: 'tabOverview',   icon: FileText  },
  { id: 'passport',  key: 'passportTitle', icon: Bot       },
  { id: 'files',     key: 'filesTitle',    icon: Paperclip },
  { id: 'stats',     key: 'tabStats',      icon: BarChart2 },
] as const

interface Props {
  overview:  React.ReactNode
  passport:  React.ReactNode
  files:     React.ReactNode
  stats:     React.ReactNode
}

export function ProjectTabs({ overview, passport, files, stats }: Props) {
  const { t } = useLang()
  const [active, setActive] = useState('overview')

  const content: Record<string, React.ReactNode> = { overview, passport, files, stats }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active === tab.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={14} />
            {t('project', tab.key)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{content[active]}</div>
    </div>
  )
}
