export const dynamic = 'force-dynamic'

import { BackButton } from '@/components/admin/BackButton'
import { UserRole } from '@prisma/client'
import { ProjectForm } from '@/components/forms/ProjectForm'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ universityId?: string }>
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP], '/admin/projects/new')
  const lang = await getRequestLang()
  const { universityId } = await searchParams
  const universityWhere = user.role === UserRole.UNIVERSITY_REP
    ? { id: user.universityId || '__none__' }
    : {}

  const [universities, technologies] = await Promise.all([
    prisma.university.findMany({ where: universityWhere, orderBy: { name: 'asc' } }),
    prisma.technology.findMany({ orderBy: { name: 'asc' } }),
  ])

  const defaultUniversityId = user.role === UserRole.UNIVERSITY_REP
    ? user.universityId || undefined
    : universityId

  return (
    <div>
      <BackButton fallback="/admin/projects" />
      <h1 className="text-xl font-bold text-slate-800 mb-6">{t('projects', 'addProject', lang)}</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <ProjectForm
          universities={universities}
          technologies={technologies}
          defaultUniversityId={defaultUniversityId}
        />
      </div>
    </div>
  )
}
