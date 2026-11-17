export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { HearingForm } from '@/components/forms/HearingForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function NewHearingPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/hearings/new')
  const lang = await getRequestLang()

  const { projectId } = await searchParams
  const projects = await prisma.project.findMany({
    include: { university: { select: { name: true, shortName: true } } },
    orderBy: { title: 'asc' },
  })

  return (
    <div>
      <Link href="/admin/hearings" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> {t('admin', 'back', lang)}
      </Link>
      <h1 className="text-xl font-bold text-slate-800 mb-6">{t('admin', 'addHearingDash', lang)}</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <HearingForm projects={projects} defaultProjectId={projectId} />
      </div>
    </div>
  )
}
