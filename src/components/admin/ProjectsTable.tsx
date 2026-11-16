'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PublicationStatus, ProjectStatus } from '@prisma/client'
import { CheckCircle2, ExternalLink, FileX, FileWarning, Loader2, Pencil, Send, Undo2, X } from 'lucide-react'
import { PublicationBadge, PublicationControl, ReturnNoteDialog } from '@/components/admin/PublicationControl'
import { DeleteProjectButton } from '@/app/admin/universities/DeleteButton'
import { showToast } from '@/components/ui/toaster'

export interface ProjectRow {
  id: string
  title: string
  /** Начало описания — чтобы решить о публикации, не открывая карточку */
  snippet: string
  university: string
  status: ProjectStatus
  statusLabel: string
  publication: PublicationStatus
  technologies: string
  noDescription: boolean
  noFiles: boolean
  /** Уже отформатированная дата отправки на проверку или создания */
  dateLabel: string
}

const STATUS_COLORS: Record<ProjectStatus, string> = {
  IDEA: 'bg-slate-100 text-slate-600',
  PROTOTYPE: 'bg-amber-100 text-amber-700',
  PILOT: 'bg-blue-100 text-blue-700',
  IMPLEMENTED: 'bg-emerald-100 text-emerald-700',
  SCALED: 'bg-violet-100 text-violet-700',
}

interface Skipped { id: string; title: string; error: string }

/**
 * Таблица проектов в админке с выбором строк и массовой сменой статуса.
 *
 * Статус в строке меняется сразу после ответа сервера (overrides), а свежие
 * данные подтягиваются следом через router.refresh(): раньше строка висела
 * со спиннером, пока перезагружался весь список.
 */
export function ProjectsTable({ rows, canModerate }: { rows: ProjectRow[]; canModerate: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [overrides, setOverrides] = useState<Record<string, PublicationStatus>>({})
  const [busy, setBusy] = useState<PublicationStatus | null>(null)
  const [askNote, setAskNote] = useState(false)
  const [skipped, setSkipped] = useState<Skipped[]>([])

  const publicationOf = (row: ProjectRow) => overrides[row.id] ?? row.publication
  const allSelected = rows.length > 0 && rows.every(row => selected.has(row.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulk(next: PublicationStatus, note?: string) {
    // Строки, которые уже в нужном статусе, не отправляем: это не ошибка
    const ids = rows.filter(row => selected.has(row.id) && publicationOf(row) !== next).map(row => row.id)
    if (ids.length === 0) {
      showToast('Выбранные проекты уже в этом статусе', 'success')
      setAskNote(false)
      return
    }
    setBusy(next)
    try {
      const res = await fetch('/api/projects/bulk-publication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, publication: next, note: note || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Не удалось изменить статус')

      const updated: string[] = data.updated || []
      const failed: Skipped[] = data.skipped || []
      setOverrides(prev => ({ ...prev, ...Object.fromEntries(updated.map(id => [id, next])) }))
      setSkipped(failed)
      // Пропущенные оставляем выбранными: их видно и можно разобрать
      setSelected(new Set(failed.map(item => item.id)))
      setAskNote(false)

      const verb = next === PublicationStatus.PUBLISHED ? 'Опубликовано'
        : next === PublicationStatus.REVIEW ? 'Отправлено на проверку' : 'Возвращено в черновики'
      if (updated.length > 0) showToast(`${verb}: ${updated.length}` + (failed.length ? `. Пропущено: ${failed.length}` : ''), 'success')
      else showToast(`Ни один проект не изменён. Пропущено: ${failed.length}`, 'error')
      router.refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const bulkBtn = 'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 bg-white'
  const th = 'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide'

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800 mr-1">Выбрано: {selected.size}</span>
          {canModerate ? (
            <>
              <button type="button" disabled={busy !== null} onClick={() => bulk(PublicationStatus.PUBLISHED)}
                className={`${bulkBtn} text-emerald-700 border-emerald-200 hover:bg-emerald-50`}>
                {busy === PublicationStatus.PUBLISHED ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                Опубликовать
              </button>
              <button type="button" disabled={busy !== null} onClick={() => setAskNote(true)}
                className={`${bulkBtn} text-slate-600 border-slate-200 hover:bg-slate-50`}>
                <Undo2 size={13} /> Вернуть в черновики
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy !== null} onClick={() => bulk(PublicationStatus.REVIEW)}
                className={`${bulkBtn} text-amber-700 border-amber-200 hover:bg-amber-50`}>
                {busy === PublicationStatus.REVIEW ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Отправить на проверку
              </button>
              <button type="button" disabled={busy !== null} onClick={() => bulk(PublicationStatus.DRAFT)}
                className={`${bulkBtn} text-slate-600 border-slate-200 hover:bg-slate-50`}>
                {busy === PublicationStatus.DRAFT ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                В черновики
              </button>
            </>
          )}
          <button type="button" onClick={() => setSelected(new Set())}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <X size={13} /> Снять выбор
          </button>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-amber-800">Не изменены: {skipped.length}</p>
            <button type="button" onClick={() => setSkipped([])} className="text-amber-500 hover:text-amber-700" aria-label="Закрыть">
              <X size={14} />
            </button>
          </div>
          <ul className="mt-1.5 space-y-1 text-xs text-amber-900">
            {skipped.map(item => (
              <li key={item.id}>
                <Link href={`/admin/projects/${item.id}/edit`} className="font-medium underline hover:no-underline">{item.title}</Link>
                {' — '}{item.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="pl-4 pr-1 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(row => row.id)))}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                  aria-label="Выбрать все проекты на странице"
                />
              </th>
              <th className={th}>Проект</th>
              <th className={th}>Вуз</th>
              <th className={th}>Статус</th>
              <th className={th}>Публикация</th>
              <th className={`${th} text-right`}>Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(row => {
              const publication = publicationOf(row)
              return (
                <tr key={row.id} className={`transition-colors ${selected.has(row.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                  <td className="pl-4 pr-1 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer mt-0.5"
                      aria-label={`Выбрать проект «${row.title}»`}
                    />
                  </td>
                  <td className="px-4 py-3 w-[42%] min-w-[260px]">
                    <p className="font-medium text-slate-800 line-clamp-1">{row.title}</p>
                    {row.noDescription ? (
                      <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                        <FileWarning size={12} className="shrink-0" /> Без описания — опубликовать нельзя
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{row.snippet}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{row.dateLabel}</span>
                      {row.noFiles && (
                        <span className="flex items-center gap-1 text-amber-600"><FileX size={11} /> без файлов</span>
                      )}
                      {row.technologies && <span className="line-clamp-1">{row.technologies}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs align-top">{row.university}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[row.status]}`}>
                      {row.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <PublicationBadge publication={publication} />
                      <PublicationControl
                        // key: после смены статуса кнопки строятся заново, без старой ошибки
                        key={publication}
                        projectId={row.id}
                        publication={publication}
                        canModerate={canModerate}
                        compact
                        onChanged={next => setOverrides(prev => ({ ...prev, [row.id]: next }))}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/projects/${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Открыть на сайте"
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <Link
                        href={`/admin/projects/${row.id}/edit`}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-300 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil size={12} /> Изменить
                      </Link>
                      <DeleteProjectButton id={row.id} name={row.title} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ReturnNoteDialog
        open={askNote}
        title={`Вернуть в черновики: ${selected.size}`}
        hint="Опубликованные проекты пропадут с портала, проекты на проверке вернутся вузам."
        busy={busy === PublicationStatus.DRAFT}
        onSubmit={note => bulk(PublicationStatus.DRAFT, note)}
        onCancel={() => setAskNote(false)}
      />
    </>
  )
}
