'use client'

import { useEffect } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  /** Что именно произойдёт. Для необратимых действий — прямо об этом. */
  children: React.ReactNode
  confirmLabel: string
  busyLabel?: string
  /** Красная кнопка и значок предупреждения — для удаления */
  danger?: boolean
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Окно подтверждения вместо системного confirm(): в нём видно, что именно
 * будет удалено, и текст ошибки остаётся на экране, а не в alert().
 */
export function ConfirmDialog({
  open, title, children, confirmLabel, busyLabel, danger, busy, error, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-left">
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} className="text-red-600" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800">{title}</h2>
            <div className="text-sm text-slate-500 mt-1 whitespace-normal break-words">{children}</div>
          </div>
        </div>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? (busyLabel || confirmLabel) : confirmLabel}
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
