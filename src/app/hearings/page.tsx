// force-dynamic + кэш в data-cache (см. комментарий в src/app/page.tsx)
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { cached } from '@/lib/data-cache'
import { PageLayout } from '@/components/layout/PageLayout'
import Link from 'next/link'
import { Mic, Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react'
import { formatDateLong } from '@/lib/utils'
import { HearingDecision } from '@prisma/client'
import { HEARING_DECISION_LABELS } from '@/types'
import { requireUser } from '@/lib/auth'
import { visibleProjectsWhere, visibilityScope } from '@/lib/publication'

const DECISION_ICONS: Record<HearingDecision, React.ElementType> = {
  PENDING: Clock,
  APPROVED: CheckCircle,
  REJECTED: XCircle,
  REVISION: AlertCircle,
  RECOMMENDED: TrendingUp,
}

const DECISION_COLORS: Record<HearingDecision, string> = {
  PENDING: 'text-slate-500 bg-slate-50 border-slate-200',
  APPROVED: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  REJECTED: 'text-red-700 bg-red-50 border-red-200',
  REVISION: 'text-amber-700 bg-amber-50 border-amber-200',
  RECOMMENDED: 'text-violet-700 bg-violet-50 border-violet-200',
}

export default async function HearingsPage() {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  const user = await requireUser('/')
  // Слушания черновиков посторонним не показываем. Ключ кэша включает
  // область видимости: набор данных зависит от роли, общий кэш отдавал бы
  // одному пользователю чужой список.
  const scope = visibilityScope(user)
  const hearings = await cached(`hearings-list:${scope}`, 60_000, () => prisma.hearing.findMany({
    where: { project: visibleProjectsWhere(user) },
    include: {
      project: {
        include: { university: { include: { region: true } } },
      },
    },
    orderBy: { date: 'desc' },
  }))

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Заслушивания</h1>
          <p className="text-slate-500 mt-1">{hearings.length} протоколов</p>
        </div>
        <Link
          href="/admin/hearings/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Добавить
        </Link>
      </div>

      {hearings.length > 0 ? (
        <div className="space-y-3">
          {hearings.map(hearing => {
            const Icon = DECISION_ICONS[hearing.decision]
            const colorClass = DECISION_COLORS[hearing.decision]
            return (
              <div key={hearing.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={12} />
                        {formatDateLong(hearing.date)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
                        <Icon size={11} />
                        {HEARING_DECISION_LABELS[hearing.decision]}
                      </span>
                    </div>

                    <Link href={`/projects/${hearing.projectId}`} className="hover:text-blue-600 transition-colors">
                      <h3 className="font-semibold text-slate-800 mb-0.5">{hearing.project.title}</h3>
                    </Link>
                    <p className="text-xs text-slate-400">
                      {hearing.project.university.shortName || hearing.project.university.name}
                      {' · '}
                      {hearing.project.university.region.name}
                    </p>

                    {hearing.commission.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-medium">Комиссия:</span> {hearing.commission.join(', ')}
                      </p>
                    )}
                    {hearing.remarks && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        <span className="font-medium">Замечания:</span> {hearing.remarks}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/admin/hearings/${hearing.id}/edit`}
                      className="text-xs text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Изменить
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-xl text-slate-400">
          <Mic size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Нет заслушиваний</p>
          <p className="text-sm mt-1">Добавьте первый протокол заслушивания</p>
        </div>
      )}
    </PageLayout>
  )
}
