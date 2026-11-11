export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDateTime } from '@/lib/datetime'

const PAGE_SIZE = 50

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-100',
  DELETE: 'bg-red-50 text-red-700 border-red-100',
  IMPORT: 'bg-violet-50 text-violet-700 border-violet-100',
}
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Создание', UPDATE: 'Изменение', DELETE: 'Удаление', IMPORT: 'Импорт',
}
const ENTITY_LABELS: Record<string, string> = {
  project: 'Проект', university: 'Вуз', user: 'Пользователь', hearing: 'Заслушивание',
  passport: 'Паспорт агента', project_file: 'Файл проекта',
  projects: 'Проекты (импорт)', universities: 'Вузы (импорт)',
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireRole([UserRole.ADMIN], '/admin/audit')

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
        <h1 className="text-xl font-bold text-slate-800">Журнал действий</h1>
        <p className="text-sm text-slate-500 mt-1">
          Кто и что менял в системе · всего записей: {total}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">Когда</th>
              <th className="px-4 py-3 font-medium">Кто</th>
              <th className="px-4 py-3 font-medium">Действие</th>
              <th className="px-4 py-3 font-medium">Объект</th>
              <th className="px-4 py-3 font-medium">Детали</th>
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
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{ENTITY_LABELS[log.entity] || log.entity}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate" title={log.details || undefined}>
                  {log.details || '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Записей пока нет — журнал начнёт заполняться при действиях в админке
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
            <ChevronLeft size={14} /> Назад
          </Link>
          <span className="text-slate-400">Стр. {page} из {totalPages}</span>
          <Link
            href={`/admin/audit?page=${page + 1}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${page >= totalPages ? 'pointer-events-none opacity-40 border-slate-100 text-slate-400' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Вперёд <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
