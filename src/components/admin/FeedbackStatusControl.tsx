'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FeedbackStatus } from '@prisma/client'
import { Loader2 } from 'lucide-react'
import { useLang } from '@/context/LangContext'

const COLORS: Record<FeedbackStatus, string> = {
  NEW: 'border-amber-200 bg-amber-50 text-amber-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

export function FeedbackStatusControl({ id, status }: { id: string; status: FeedbackStatus }) {
  const { t } = useLang()
  const router = useRouter()

  const LABELS: Record<FeedbackStatus, string> = {
    NEW: t('admin', 'fbNew'),
    IN_PROGRESS: t('admin', 'fbInProgress'),
    DONE: t('admin', 'fbDone'),
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function change(next: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('admin', 'fbStatusFailed'))
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
      <select
        value={status}
        disabled={busy}
        onChange={event => change(event.target.value)}
        className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${COLORS[status]}`}
      >
        {(Object.keys(LABELS) as FeedbackStatus[]).map(value => (
          <option key={value} value={value}>{LABELS[value]}</option>
        ))}
      </select>
    </div>
  )
}
