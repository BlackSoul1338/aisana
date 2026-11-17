'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { REQUEST_TYPE_LABELS, requestTypeLabel } from '@/lib/integration-requests'
import { useLang } from '@/context/LangContext'

const TYPE_KEYS = Object.keys(REQUEST_TYPE_LABELS) as (keyof typeof REQUEST_TYPE_LABELS)[]

/** Форма запроса компании по решению: уходит оператору портала. */
export function IntegrationRequestForm({ projectId }: { projectId: string }) {
  const { t, lang } = useLang()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = event.currentTarget
    const payload = { ...Object.fromEntries(new FormData(form).entries()), projectId }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('requestForm', 'failed'))
      }
      form.reset()
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={24} />
        <p className="text-sm font-medium text-emerald-900">{t('requestForm', 'sentTitle')}</p>
        <p className="mt-1 text-xs text-emerald-700">
          {t('requestForm', 'sentText')}
        </p>
        <Link
          href="/business/requests"
          className="mt-3 inline-block text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
        >
          {t('requestForm', 'myRequests')}
        </Link>
      </div>
    )
  }

  const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const label = 'mb-1 block text-sm font-medium text-slate-700'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className={label} htmlFor="ir-type">{t('requestForm', 'typeLabel')}</label>
        <select id="ir-type" name="type" defaultValue="CONSULTATION" className={input}>
          {TYPE_KEYS.map(value => <option key={value} value={value}>{requestTypeLabel(value, lang)}</option>)}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="ir-message">{t('requestForm', 'messageLabel')} <span className="text-red-500">*</span></label>
        <textarea
          id="ir-message" name="message" required minLength={10} maxLength={4000} rows={4}
          className={`${input} resize-none`}
          placeholder={t('requestForm', 'messagePlaceholder')}
        />
      </div>

      <div>
        <label className={label} htmlFor="ir-phone">{t('requestForm', 'phoneLabel')}</label>
        <input id="ir-phone" name="contactPhone" maxLength={40} className={input} placeholder="+7 7XX XXX XX XX" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {loading ? t('requestForm', 'sending') : t('requestForm', 'send')}
      </button>

      <p className="text-xs text-slate-400">
        {t('requestForm', 'consent')}
      </p>
    </form>
  )
}
