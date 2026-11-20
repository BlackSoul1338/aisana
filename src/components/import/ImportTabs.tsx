'use client'

import { useState } from 'react'
import { Building2, FolderKanban } from 'lucide-react'
import { useLang } from '@/context/LangContext'

interface Props {
  projectForm: React.ReactNode
  universityForm: React.ReactNode
  projectColumns: string[][]
  universityColumns: string[][]
  showUniversitiesTab?: boolean
}

export function ImportTabs({
  projectForm,
  universityForm,
  projectColumns,
  universityColumns,
  showUniversitiesTab = true,
}: Props) {
  const { t } = useLang()
  // If the user has no permission to import universities, default straight to projects
  const [tab, setTab] = useState<'universities' | 'projects'>(showUniversitiesTab ? 'universities' : 'projects')

  const columns = tab === 'universities' ? universityColumns : projectColumns

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-200">
        {showUniversitiesTab && (
          <button
            onClick={() => setTab('universities')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'universities'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Building2 size={15} />
            {t('importSection', 'tabUniversities')}
          </button>
        )}
        <button
          onClick={() => setTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'projects'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FolderKanban size={15} />
          {t('importSection', 'tabProjects')}
        </button>
      </div>

      {/* Form */}
      {tab === 'universities' ? universityForm : projectForm}

      {/* Column reference */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('importSection', 'columnsPrefix')} — {tab === 'universities' ? t('importSection', 'tabUniversities').toLowerCase() : t('importSection', 'tabProjects').toLowerCase()}
        </h2>

        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
          {t('importSection', 'columnsNote')}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{t('importSection', 'colName')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{t('importSection', 'colNote')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {columns.map(([name, note]) => (
                <tr key={name} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">{name}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
