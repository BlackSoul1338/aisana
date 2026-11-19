export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { BusinessNeedStatus, UserRole } from '@prisma/client'
import { Inbox } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDateLong } from '@/lib/utils'
import { PageLayout } from '@/components/layout/PageLayout'
import { NeedAssistant } from '@/components/need/NeedAssistant'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const HISTORY_LIMIT = 20

/** Новая потребность и прежние диалоги компании. */
export default async function AssistantPage() {
  const user = await requireRole([UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR], '/business/assistant')
  const lang = await getRequestLang()

  const needs = await prisma.businessNeed.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { id: true, status: true, readiness: true, messages: true, updatedAt: true },
  })

  return (
    <PageLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('solutions', 'pickTitle', lang)}</h1>
          <p className="mt-1 text-slate-500">{t('solutions', 'pickSubtitle', lang)}</p>
        </div>
        <Link
          href="/business/requests"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
        >
          <Inbox size={15} /> {t('solutions', 'myRequests', lang)}
        </Link>
      </div>

      <NeedAssistant initialNeed={null} initialMatches={[]} aiEnabled={Boolean(process.env.GEMINI_API_KEY)} />

      {needs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold text-slate-800">{t('solutions', 'pastPicks', lang)}</h2>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {needs.map(need => {
              const first = (need.messages as { role: string; text: string }[]).find(m => m.role === 'user')?.text ?? ''
              return (
                <Link key={need.id} href={`/business/assistant/${need.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <span className="w-12 shrink-0 text-sm font-semibold text-slate-500">{need.readiness}%</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{first}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${need.status === BusinessNeedStatus.SENT ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {need.status === BusinessNeedStatus.SENT ? t('solutions', 'sent', lang) : t('solutions', 'inProgress', lang)}
                  </span>
                  <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{formatDateLong(need.updatedAt, lang)}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
