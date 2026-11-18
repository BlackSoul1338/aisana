import Link from 'next/link'
import { Building2, Users, Calendar, Star } from 'lucide-react'
import { ProjectWithRelations } from '@/types'
import { StatusBadge } from './status-badge'
import { CategoryBadge } from './category-badge'
import { formatDate } from '@/lib/utils'
import { technologyLabel } from '@/lib/technologies'
import type { Lang } from '@/lib/i18n'

interface Props {
  project: ProjectWithRelations
  lang: Lang
}

export function ProjectCard({ project, lang }: Props) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
            {project.title}
          </h3>
          {project.isBestPractice && (
            <Star size={16} className="text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusBadge status={project.status} size="sm" />
          <CategoryBadge category={project.category} />
        </div>

        {/* Description */}
        <p className="text-slate-500 text-xs line-clamp-2 mb-4 leading-relaxed">
          {project.description}
        </p>

        {/* Meta */}
        <div className="space-y-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Building2 size={12} className="text-slate-400" />
            <span className="truncate">{project.university.shortName || project.university.name}</span>
          </div>
          {project.leadName && (
            <div className="flex items-center gap-1.5">
              <Users size={12} className="text-slate-400" />
              <span>{project.leadName}</span>
            </div>
          )}
          {project.launchDate && (
            <div className="flex items-center gap-1.5">
              <Calendar size={12} className="text-slate-400" />
              <span>{formatDate(project.launchDate)}</span>
            </div>
          )}
        </div>

        {/* Technologies */}
        {project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
            {project.technologies.slice(0, 4).map(tech => (
              <span
                key={tech.id}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium"
              >
                {technologyLabel(tech, lang)}
              </span>
            ))}
            {project.technologies.length > 4 && (
              <span className="px-2 py-0.5 text-slate-400 text-[11px]">
                +{project.technologies.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
