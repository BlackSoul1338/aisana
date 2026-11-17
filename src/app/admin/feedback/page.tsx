export const dynamic = 'force-dynamic'

import { FeedbackStatus, FeedbackTopic, UserRole } from '@prisma/client'
import { Mail, Building2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDateLong } from '@/lib/utils'
import { FeedbackStatusControl } from '@/components/admin/FeedbackStatusControl'
import { Pagination } from '@/components/admin/Pagination'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const PAGE_SIZE = 20

const TOPIC_COLORS: Record<FeedbackTopic, string> = {
  ACCESS_REQUEST: 'bg-blue-100 text-blue-700',
  ADD_PROJECT: 'bg-violet-100 text-violet-700',
  BUG: 'bg-red-100 text-red-700',
  QUESTION: 'bg-slate-100 text-slate-600',
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/feedback')
  const lang = await getRequestLang()
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)

  const where = params.status && params.status in FeedbackStatus
    ? { status: params.status as FeedbackStatus }
    : {}

  const [items, total, newCount] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { status: FeedbackStatus.NEW } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const TOPIC_LABELS: Record<FeedbackTopic, string> = {
    ACCESS_REQUEST: t('feedbackAdmin', 'topicAccess', lang),
    ADD_PROJECT: t('feedbackAdmin', 'topicProject', lang),
    BUG: t('feedbackAdmin', 'topicBug', lang),
    QUESTION: t('feedbackAdmin', 'topicQuestion', lang),
  }

  const tabs = [
    { value: '', label: `${t('common', 'all', lang)} (${total})` },
    { value: 'NEW', label: `${t('feedbackAdmin', 'newTab', lang)} (${newCount})` },
    { value: 'IN_PROGRESS', label: t('admin', 'fbInProgress', lang) },
    { value: 'DONE', label: t('admin', 'fbDone', lang) },
  ]

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">{t('admin', 'navFeedback', lang)}</h1>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(tab => {
          const active = (params.status || '') === tab.value
          return (
            <a
              key={tab.value || 'all'}
              href={tab.value ? `/admin/feedback?status=${tab.value}` : '/admin/feedback'}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </a>
          )
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
          {t('feedbackAdmin', 'noneYet', lang)}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TOPIC_COLORS[item.topic]}`}>
                  {TOPIC_LABELS[item.topic]}
                </span>
                <span className="text-xs text-slate-400">{formatDateLong(item.createdAt)}</span>
                <div className="ml-auto">
                  <FeedbackStatusControl id={item.id} status={item.status} />
                </div>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.message}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{item.name}</span>
                <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                  <Mail size={12} /> {item.email}
                </a>
                {item.organization && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 size={12} /> {item.organization}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5">
          <Pagination
            basePath="/admin/feedback"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            searchParams={params as Record<string, string | undefined>}
            totalLabel={t('common', 'total', lang)}
          />
        </div>
      )}
    </div>
  )
}
