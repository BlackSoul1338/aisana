export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { HearingForm } from '@/components/forms/HearingForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function EditHearingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/hearings')
  const lang = await getRequestLang()

  const { id } = await params
  const [hearing, projects] = await Promise.all([
    prisma.hearing.findUnique({ where: { id } }),
    prisma.project.findMany({
      include: { university: { select: { name: true, shortName: true } } },
      orderBy: { title: 'asc' },
    }),
  ])

  if (!hearing) notFound()

  return (
    <div>
      <Link href="/admin/hearings" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> {t('admin', 'back', lang)}
      </Link>
      <h1 className="text-xl font-bold text-slate-800 mb-6">{t('hearings', 'editHearing', lang)}</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <HearingForm projects={projects} hearing={hearing as any} />
      </div>
    </div>
  )
}
