'use client'

import Link from 'next/link'
import { FolderKanban } from 'lucide-react'
import { useLang } from '@/context/LangContext'
import { AutoSubmitForm } from '@/components/ui/AutoSubmitForm'
import { Pagination } from '@/components/admin/Pagination'
import { plural } from '@/lib/plural'
import { SolutionCard, type SolutionProject } from './SolutionCard'

interface Props {
  projects: SolutionProject[]
  total: number
  page: number
  pageSize: number
  tech?: string
  technologies: { slug: string; name: string }[]
}

/** Клиентская часть витрины: язык берётся из cookie 'lang' через LangContext. */
export function SolutionsView({ projects, total, page, pageSize, tech, technologies }: Props) {
  const { lang, t } = useLang()
  const count = lang === 'ru'
    ? `${total} ${plural(total, 'решение', 'решения', 'решений')}`
    : `${total} шешім`

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('solutions', 'title')}</h1>
        <p className="mt-1 max-w-3xl text-slate-500">{t('solutions', 'subtitle')}</p>
        <p className="mt-2 text-sm text-slate-400">{count}</p>
      </div>

      <AutoSubmitForm className="mb-6 flex flex-wrap items-center gap-3">
        <select
          name="tech"
          defaultValue={tech || ''}
          aria-label={t('solutions', 'allTech')}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">{t('solutions', 'allTech')}</option>
          {technologies.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select>
        {tech && (
          <Link href="/business/solutions" className="text-sm text-slate-400 hover:text-slate-600">
            {t('solutions', 'reset')}
          </Link>
        )}
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700">
          {t('projects', 'apply')}
        </button>
      </AutoSubmitForm>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <SolutionCard
              key={project.id}
              project={project}
              readyLabel={t('solutions', 'ready')}
              detailsLabel={t('solutions', 'details')}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white py-20 text-center text-slate-400">
          <FolderKanban size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">{t('solutions', tech ? 'emptyFilter' : 'empty')}</p>
          <p className="mt-1 text-sm">{t('solutions', 'emptyHint')}</p>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        totalItems={total}
        basePath="/business/solutions"
        searchParams={{ tech }}
        totalLabel={t('solutions', 'total')}
      />
    </div>
  )
}
