'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { REQUEST_TYPE_LABELS } from '@/lib/integration-requests'

const TYPES = Object.entries(REQUEST_TYPE_LABELS) as [keyof typeof REQUEST_TYPE_LABELS, string][]

/** Форма запроса компании по решению: уходит оператору портала. */
export function IntegrationRequestForm({ projectId }: { projectId: string }) {
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
        throw new Error(data.error || 'Не удалось отправить запрос')
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
        <p className="text-sm font-medium text-emerald-900">Запрос отправлен</p>
        <p className="mt-1 text-xs text-emerald-700">
          Оператор AiSana проверит его и свяжется с вами по почте.
        </p>
        <Link
          href="/business/requests"
          className="mt-3 inline-block text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
        >
          Мои запросы
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
        <label className={label} htmlFor="ir-type">Что нужно</label>
        <select id="ir-type" name="type" defaultValue="CONSULTATION" className={input}>
          {TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="ir-message">Задача компании <span className="text-red-500">*</span></label>
        <textarea
          id="ir-message" name="message" required minLength={10} maxLength={4000} rows={4}
          className={`${input} resize-none`}
          placeholder="Какой процесс хотите улучшить, какие данные есть, сроки"
        />
      </div>

      <div>
        <label className={label} htmlFor="ir-phone">Телефон</label>
        <input id="ir-phone" name="contactPhone" maxLength={40} className={input} placeholder="+7 7XX XXX XX XX" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {loading ? 'Отправка…' : 'Отправить запрос'}
      </button>

      <p className="text-xs text-slate-400">
        Запрос увидит оператор AiSana, а после проверки — вуз-разработчик. Контакты
        из вашей учётной записи передаются вместе с запросом.
      </p>
    </form>
  )
}
