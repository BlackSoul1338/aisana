export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { DeleteHearingButton } from '../universities/DeleteButton'
import { HearingDecision, UserRole } from '@prisma/client'
import { formatDate } from '@/lib/utils'
import { requireRole } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const DECISION_COLORS: Record<HearingDecision, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  REVISION: 'bg-amber-100 text-amber-700',
  RECOMMENDED: 'bg-violet-100 text-violet-700',
}

export default async function AdminHearingsPage() {
  await requireRole([UserRole.ADMIN, UserRole.EDITOR], '/admin/hearings')
  const lang = await getRequestLang()

  const hearings = await prisma.hearing.findMany({
    include: {
      project: { include: { university: { select: { name: true, shortName: true } } } },
    },
    orderBy: { date: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">{t('hearings', 'title', lang)} ({hearings.length})</h1>
        <Link
          href="/admin/hearings/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          {t('hearings', 'add', lang)}
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{t('hearings', 'date', lang)}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{t('adminProjects', 'colProject', lang)}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">{t('hearings', 'decision', lang)}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">{t('users', 'colActions', lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {hearings.map(h => (
              <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(h.date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800 line-clamp-1">{h.project.title}</p>
                  <p className="text-xs text-slate-400">{h.project.university.shortName || h.project.university.name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DECISION_COLORS[h.decision]}`}>
                    {t('hearings', h.decision, lang)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/hearings/${h.id}/edit`}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil size={12} /> {t('common', 'edit', lang)}
                    </Link>
                    <DeleteHearingButton id={h.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hearings.length === 0 && (
          <div className="text-center py-12 text-slate-400">{t('hearings', 'empty', lang)}</div>
        )}
      </div>
    </div>
  )
}
