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
      {/* Tab bar: на телефоне вкладки не помещаются — листаются вбок, страница не уезжает */}
      <div className="border-b border-slate-200 mb-6">
        <div className="nav-scroll flex gap-1 overflow-x-auto -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
      </div>

      {/* Content */}
      <div>{content[active]}</div>
    </div>
  )
}
