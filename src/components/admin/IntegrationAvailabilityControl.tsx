'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CircleSlash, Loader2 } from 'lucide-react'
import { showToast } from '@/components/ui/toaster'
import { useLang } from '@/context/LangContext'

interface Props {
  projectId: string
  availableForIntegration: boolean
}

/** Открывает проект в витрине /business/solutions или убирает из неё. */
export function IntegrationAvailabilityControl({ projectId, availableForIntegration }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/integration-availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableForIntegration: !availableForIntegration }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('admin', 'integrationFailed'))
      }
      showToast(
        availableForIntegration ? t('admin', 'integrationRemovedToast') : t('admin', 'integrationOpenedToast'),
        'success',
      )
      router.refresh()
    } catch (error: any) {
      showToast(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        availableForIntegration
          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {busy
        ? <Loader2 size={12} className="animate-spin" />
        : availableForIntegration ? <CircleSlash size={12} /> : <CheckCircle2 size={12} />}
      {availableForIntegration ? t('admin', 'integrationRemove') : t('admin', 'integrationOpen')}
    </button>
  )
}
