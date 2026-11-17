export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { Building2, FolderKanban, Inbox, MessagesSquare } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDateLong } from '@/lib/utils'
import { REQUEST_STATUS_BADGE, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from '@/lib/integration-requests'
import { PageLayout } from '@/components/layout/PageLayout'
import { LogoutButton } from '@/components/auth/LogoutButton'

/** Запросы компании: что отправлено, на каком этапе, что ответил вуз. */
export default async function BusinessRequestsPage() {
  // Модераторы пускаются, чтобы видеть страницу глазами компании
  const user = await requireRole([UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR], '/business/requests')

  const requests = await prisma.integrationRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, type: true, status: true, message: true, universityNote: true, createdAt: true,
      project: { select: { id: true, title: true, university: { select: { shortName: true, name: true } } } },
    },
  })

  return (
    <PageLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Мои запросы</h1>
          <p className="mt-1 text-slate-500">
            {user.organization ? <>{user.organization} · </> : null}{user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/business/assistant"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-600"
          >
            <MessagesSquare size={15} /> Подобрать решение
          </Link>
          <div className="w-28"><LogoutButton /></div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
          <Inbox size={44} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Запросов пока нет</p>
          <p className="mt-1 text-sm">
            Откройте решение в <Link href="/business/solutions" className="text-blue-600 hover:underline">витрине решений</Link> и
            отправьте запрос — оператор AiSana свяжет вас с вузом.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${REQUEST_STATUS_BADGE[request.status]}`}>
                  {REQUEST_STATUS_LABELS[request.status]}
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {REQUEST_TYPE_LABELS[request.type]}
                </span>
                <span className="text-xs text-slate-400">{formatDateLong(request.createdAt)}</span>
              </div>

              {request.project ? (
                <p className="mb-2 flex flex-wrap items-center gap-x-2 text-sm">
                  <FolderKanban size={14} className="text-slate-400" />
                  <Link href={`/projects/${request.project.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                    {request.project.title}
                  </Link>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Building2 size={12} /> {request.project.university.shortName || request.project.university.name}
                  </span>
                </p>
              ) : (
                <p className="mb-2 text-sm text-slate-500">Решение подбирает оператор AiSana</p>
              )}

              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{request.message}</p>

              {request.universityNote && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Ответ вуза</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{request.universityNote}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
