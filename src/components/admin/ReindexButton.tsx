'use client'

import { useLang } from '@/context/LangContext'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'

/**
 * Полная переиндексация: пересчитывает тематические направления всех проектов.
 * Нужна после правки справочника направлений или массового импорта.
 */
export function ReindexButton() {
  const { t } = useLang()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  async function run() {
    setBusy(true)
    setResult('')
    try {
      const res = await fetch('/api/admin/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('admin', 'reindexFailed'))
      setResult(`${t('admin', 'reindexDonePrefix')}: ${data.projects} ${t('admin', 'reindexProjects')}, ${data.topics} ${t('admin', 'reindexTopics')} ${t('admin', 'reindexIn')} ${data.durationMs} ${t('common', 'ms')}`)
      router.refresh()
    } catch (err: any) {
      setResult(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {busy ? t('admin', 'reindexBusy') : t('admin', 'reindexRun')}
      </button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  )
}
