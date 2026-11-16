export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { IntegrationRequestStatus, UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { Building2, Mail, Phone } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { formatDateLong } from '@/lib/utils'
import {
  REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, canChangeStatus, canSetProject, canWriteUniversityNote,
  visibleRequestsWhere,
} from '@/lib/integration-requests'
import { RequestControls } from '@/components/requests/RequestControls'
import { Pagination } from '@/components/admin/Pagination'

const PAGE_SIZE = 20
const ALL_STATUSES = Object.keys(REQUEST_STATUS_LABELS) as IntegrationRequestStatus[]

/**
 * Очередь запросов бизнеса. Оператор видит все запросы, представитель вуза —
 * только переданные ему по проектам своего вуза.
 */
export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const user = await requireRole([UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP], '/admin/requests')
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const moderator = canModerate(user)

  const visible = visibleRequestsWhere(user)
  const status = params.status && params.status in REQUEST_STATUS_LABELS
    ? params.status as IntegrationRequestStatus
    : undefined
  const where: Prisma.IntegrationRequestWhereInput = { ...visible, ...(status ? { status } : {}) }

  // Вкладка «ждут действия»: оператору — новые, вузу — переданные ему
  const waitingStatus = moderator ? IntegrationRequestStatus.NEW : IntegrationRequestStatus.SENT_TO_UNIVERSITY

  const [items, total, totalAll, waiting] = await Promise.all([
    prisma.integrationRequest.findMany({
      where,
      include: { project: { select: { id: true, title: true, universityId: true, university: { select: { shortName: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.integrationRequest.count({ where }),
    prisma.integrationRequest.count({ where: visible }),
    prisma.integrationRequest.count({ where: { ...visible, status: waitingStatus } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const tabs = [
    { value: '', label: `Все (${totalAll})` },
    { value: waitingStatus, label: `${REQUEST_STATUS_LABELS[waitingStatus]} (${waiting})` },
    ...ALL_STATUSES
      .filter(value => value !== waitingStatus && (moderator || value !== IntegrationRequestStatus.NEW && value !== IntegrationRequestStatus.IN_REVIEW))
      .map(value => ({ value, label: REQUEST_STATUS_LABELS[value] })),
  ]

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-800">Запросы бизнеса</h1>
      <p className="mb-6 text-sm text-slate-500">
        {moderator
          ? 'Компании просят демонстрацию, консультацию, пилот или внедрение. Проверьте запрос и передайте его вузу.'
          : 'Запросы компаний по проектам вашего вуза, переданные оператором AiSana. Свяжитесь с компанией и отметьте результат.'}
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(tab => {
          const active = (params.status || '') === tab.value
          return (
            <a
              key={tab.value || 'all'}
              href={tab.value ? `/admin/requests?status=${tab.value}` : '/admin/requests'}
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
          Запросов пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const scope = { ...item, project: item.project ? { universityId: item.project.universityId } : null }
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {REQUEST_TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateLong(item.createdAt)}</span>
                  {item.forwardedAt && (
                    <span className="text-xs text-slate-400">· передан вузу {formatDateLong(item.forwardedAt)}</span>
                  )}
                </div>

                <p className="mb-1 text-sm">
                  {item.project ? (
                    <>
                      <Link href={`/projects/${item.project.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                        {item.project.title}
                      </Link>
                      <span className="text-slate-400"> · {item.project.university.shortName || item.project.university.name}</span>
                    </>
                  ) : (
                    <span className="text-amber-700">Проект не выбран — привяжите его, чтобы передать запрос вузу</span>
                  )}
                </p>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.message}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {item.contactName && <span className="font-medium text-slate-700">{item.contactName}</span>}
                  <a href={`mailto:${item.contactEmail}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                    <Mail size={12} /> {item.contactEmail}
                  </a>
                  {item.contactPhone && (
                    <span className="inline-flex items-center gap-1"><Phone size={12} /> {item.contactPhone}</span>
                  )}
                  {item.organization && (
                    <span className="inline-flex items-center gap-1"><Building2 size={12} /> {item.organization}</span>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <RequestControls
                    id={item.id}
                    status={item.status}
                    nextStatuses={ALL_STATUSES.filter(next => canChangeStatus(user, scope, next))}
                    operatorNote={moderator ? item.operatorNote : null}
                    universityNote={item.universityNote}
                    canEditOperatorNote={moderator}
                    canEditUniversityNote={canWriteUniversityNote(user, scope)}
                    canSetProject={canSetProject(user, scope)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5">
          <Pagination
            basePath="/admin/requests"
            page={page}
            totalPages={totalPages}
            totalItems={total}
            searchParams={params as Record<string, string | undefined>}
          />
        </div>
      )}
    </div>
  )
}
