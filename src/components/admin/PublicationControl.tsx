'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PublicationStatus } from '@prisma/client'
import { CheckCircle2, Loader2, Send, EyeOff, Undo2 } from 'lucide-react'
import { PUBLICATION_BADGE, PUBLICATION_LABELS } from '@/lib/publication'
import { showToast } from '@/components/ui/toaster'

interface Props {
  projectId: string
  publication: PublicationStatus
  /** Администратор или редактор — может публиковать и снимать с публикации */
  canModerate: boolean
  /** Компактный режим для таблицы */
  compact?: boolean
  /** Список обновляет строку сам, не дожидаясь перезагрузки данных */
  onChanged?: (next: PublicationStatus) => void
}

export function PublicationBadge({ publication }: { publication: PublicationStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${PUBLICATION_BADGE[publication]}`}>
      {PUBLICATION_LABELS[publication]}
    </span>
  )
}

/** Что сказать пользователю после смены статуса */
export function publicationDoneText(next: PublicationStatus, previous: PublicationStatus): string {
  if (next === PublicationStatus.PUBLISHED) return 'Проект опубликован'
  if (next === PublicationStatus.REVIEW) return 'Проект отправлен на проверку'
  return previous === PublicationStatus.PUBLISHED ? 'Проект снят с публикации' : 'Проект возвращён в черновики'
}

/**
 * Окно с комментарием при возврате на доработку и снятии с публикации.
 * Комментарий видит представитель вуза в карточке проекта — без него вуз
 * получает проект обратно, не зная, что исправлять.
 */
export function ReturnNoteDialog({ open, title, hint, busy, error, onSubmit, onCancel }: {
  open: boolean
  title: string
  hint: string
  busy?: boolean
  error?: string
  onSubmit: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = useState('')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-left">
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-1 mb-3">{hint}</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          maxLength={1000}
          autoFocus
          placeholder="Например: добавьте описание решения и ссылку на рабочую версию"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-slate-400 mt-1 mb-4">Комментарий увидит представитель вуза. Можно оставить пустым.</p>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSubmit(note)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Вернуть
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

export function PublicationControl({ projectId, publication, canModerate, compact, onChanged }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [askNote, setAskNote] = useState(false)

  async function change(next: PublicationStatus, note?: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/publication`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publication: next, note: note || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось изменить статус')
      }
      setAskNote(false)
      showToast(publicationDoneText(next, publication), 'success')
      onChanged?.(next)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      // В таблице под строкой мало места — дублируем заметным сообщением
      if (compact && !askNote) showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const btn = 'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 whitespace-nowrap'

  const actions: React.ReactNode[] = []

  if (publication !== PublicationStatus.PUBLISHED && canModerate) {
    actions.push(
      <button key="pub" type="button" disabled={busy} onClick={() => change(PublicationStatus.PUBLISHED)}
        className={`${btn} text-emerald-700 border-emerald-200 hover:bg-emerald-50`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Опубликовать
      </button>
    )
  }

  if (publication === PublicationStatus.DRAFT && !canModerate) {
    actions.push(
      <button key="send" type="button" disabled={busy} onClick={() => change(PublicationStatus.REVIEW)}
        className={`${btn} text-amber-700 border-amber-200 hover:bg-amber-50`}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} На проверку
      </button>
    )
  }

  if (publication === PublicationStatus.REVIEW) {
    actions.push(
      <button key="back" type="button" disabled={busy}
        // Модератор объясняет вузу, что исправить; вуз забирает свой проект без вопросов
        onClick={() => (canModerate ? setAskNote(true) : change(PublicationStatus.DRAFT))}
        className={`${btn} text-slate-600 border-slate-200 hover:bg-slate-50`}>
        <Undo2 size={12} /> {canModerate ? 'Вернуть на доработку' : 'В черновик'}
      </button>
    )
  }

  if (publication === PublicationStatus.PUBLISHED && canModerate) {
    actions.push(
      <button key="hide" type="button" disabled={busy} onClick={() => setAskNote(true)}
        className={`${btn} text-slate-600 border-slate-200 hover:bg-slate-50`}>
        <EyeOff size={12} /> Снять с публикации
      </button>
    )
  }

  if (actions.length === 0 && !error) return null

  return (
    <div className={compact ? 'flex items-center gap-1.5 flex-wrap' : 'flex flex-wrap items-center gap-2'}>
      {actions}
      {error && !compact && !askNote && <span className="text-xs text-red-600">{error}</span>}
      <ReturnNoteDialog
        open={askNote}
        title={publication === PublicationStatus.PUBLISHED ? 'Снять с публикации?' : 'Вернуть на доработку?'}
        hint={publication === PublicationStatus.PUBLISHED
          ? 'Проект пропадёт с портала и вернётся вузу в черновики.'
          : 'Проект вернётся вузу в черновики.'}
        busy={busy}
        error={error}
        onSubmit={note => change(PublicationStatus.DRAFT, note)}
        onCancel={() => { setAskNote(false); setError('') }}
      />
    </div>
  )
}
