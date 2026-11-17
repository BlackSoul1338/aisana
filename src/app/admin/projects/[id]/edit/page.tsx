export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { BackButton } from '@/components/admin/BackButton'
import { PublicationStatus, UserRole } from '@prisma/client'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, requireRole } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { PublicationBadge, PublicationControl } from '@/components/admin/PublicationControl'
import { IntegrationAvailabilityControl } from '@/components/admin/IntegrationAvailabilityControl'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP], '/admin/projects')
  const { id } = await params

  const [project, universities, technologies] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        technologies: true,
        files: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.university.findMany({
      where: user.role === UserRole.UNIVERSITY_REP ? { id: user.universityId || '__none__' } : {},
      orderBy: { name: 'asc' },
    }),
    prisma.technology.findMany({ orderBy: { name: 'asc' } }),
  ])

  if (!project || !canAccessUniversity(user, project.universityId)) notFound()

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BackButton fallback="/admin/projects" />
        {project.publication === PublicationStatus.PUBLISHED && (
          <a
            href={`/projects/${project.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded-lg mb-6 transition-colors"
          >
            <ExternalLink size={13} /> Открыть на сайте
          </a>
        )}
      </div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">
        Редактировать: {project.title}
      </h1>

      {/* Статус публикации и действия модерации */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <span className="text-sm text-slate-500">Публикация:</span>
        <PublicationBadge publication={project.publication} />
        <PublicationControl
          projectId={project.id}
          publication={project.publication}
          canModerate={canModerate(user)}
        />
        {project.publication !== PublicationStatus.PUBLISHED && (
          <p className="w-full text-xs text-slate-400">
            {project.publication === PublicationStatus.DRAFT
              ? 'Черновик виден только в админ-панели. Отправьте на проверку, когда всё заполнено.'
              : 'Проект ждёт проверки администратора и пока не показывается на портале.'}
          </p>
        )}
        {project.moderationNote && (
          <p className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Комментарий модератора: {project.moderationNote}
          </p>
        )}
      </div>

      {canModerate(user) && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">Витрина решений:</span>
            <IntegrationAvailabilityControl
              projectId={project.id}
              availableForIntegration={project.availableForIntegration}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Открытые проекты попадают в витрину для бизнеса. Публикация важнее флага:
            черновик и проект на проверке в витрину не показываются.
          </p>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <ProjectForm
          universities={universities}
          technologies={technologies}
          project={project as any}
        />
      </div>
    </div>
  )
}
