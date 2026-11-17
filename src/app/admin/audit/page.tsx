export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDateTime } from '@/lib/datetime'
import { t, translations } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

const PAGE_SIZE = 50

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-100',
  DELETE: 'bg-red-50 text-red-700 border-red-100',
  IMPORT: 'bg-violet-50 text-violet-700 border-violet-100',
}

// Известные ключи журнала — из самого словаря, без дублирования списка
const AUDIT_KEYS = new Set(Object.keys(translations.audit))

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole([UserRole.ADMIN], '/admin/audit')
  const lang = await getRequestLang()

  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">{t('admin', 'navAudit', lang)}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('audit', 'totalRecords', lang)} {total}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">{t('audit', 'colWhen', lang)}</th>
              <th className="px-4 py-3 font-medium">{t('audit', 'colWho', lang)}</th>
              <th className="px-4 py-3 font-medium">{t('audit', 'colAction', lang)}</th>
              <th className="px-4 py-3 font-medium">{t('audit', 'colEntity', lang)}</th>
              <th className="px-4 py-3 font-medium">{t('audit', 'colDetails', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{log.userEmail}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded border ${ACTION_STYLES[log.action] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                    {AUDIT_KEYS.has(`action_${log.action}`) ? t('audit', `action_${log.action}`, lang) : log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{AUDIT_KEYS.has(`entity_${log.entity}`) ? t('audit', `entity_${log.entity}`, lang) : log.entity}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate" title={log.details || undefined}>
                  {log.details || '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  {t('audit', 'empty', lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <Link
            href={`/admin/audit?page=${page - 1}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${page <= 1 ? 'pointer-events-none opacity-40 border-slate-100 text-slate-400' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <ChevronLeft size={14} /> {t('admin', 'back', lang)}
          </Link>
          <span className="text-slate-400">{t('audit', 'pageOf', lang)} {page} {t('audit', 'ofWord', lang)} {totalPages}</span>
          <Link
            href={`/admin/audit?page=${page + 1}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${page >= totalPages ? 'pointer-events-none opacity-40 border-slate-100 text-slate-400' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {t('audit', 'next', lang)} <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
