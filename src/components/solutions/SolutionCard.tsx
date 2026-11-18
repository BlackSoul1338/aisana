import Link from 'next/link'
import { ArrowRight, Building2, CheckCircle2 } from 'lucide-react'
import type { ProjectCategory, ProjectStatus } from '@/types'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { technologyLabel } from '@/lib/technologies'
import type { Lang } from '@/lib/i18n'

/**
 * Только поля карточки. Клиентская витрина сериализует их в браузер,
 * поэтому контакты руководителя и прочие служебные поля сюда не попадают.
 */
export interface SolutionProject {
  id: string
  title: string
  description: string
  status: ProjectStatus
  category: ProjectCategory
  university: { name: string; shortName: string | null }
  technologies: { id: string; name: string; slug: string }[]
}

interface Props {
  project: SolutionProject
  lang: Lang
  readyLabel: string
  detailsLabel: string
}

/** Карточка витрины: только то, по чему бизнес решает, подходит ли решение. */
export function SolutionCard({ project, lang, readyLabel, detailsLabel }: Props) {
  return (
    <Link href={`/projects/${project.id}`} className="group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md">
      <div className="mb-3 flex flex-wrap gap-2">
        <StatusBadge status={project.status} size="sm" />
        <CategoryBadge category={project.category} />
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 size={11} /> {readyLabel}
        </span>
      </div>

      <h3 className="text-sm font-semibold leading-snug text-slate-800 transition-colors group-hover:text-blue-600">
        {project.title}
      </h3>

      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
        <Building2 size={12} className="shrink-0" />
        <span className="truncate">{project.university.shortName || project.university.name}</span>
      </p>

      <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-500">{project.description}</p>

      {project.technologies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.technologies.slice(0, 3).map(tech => (
            <span key={tech.id} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {technologyLabel(tech, lang)}
            </span>
          ))}
        </div>
      )}

      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600">
        {detailsLabel} <ArrowRight size={12} />
      </span>
    </Link>
  )
}
