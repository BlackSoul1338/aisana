'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Send } from 'lucide-react'

const TOPICS = [
  { value: 'ACCESS_REQUEST', label: 'Запросить доступ (вуз или компания)' },
  { value: 'ADD_PROJECT', label: 'Предложить проект' },
  { value: 'BUG', label: 'Сообщить об ошибке' },
  { value: 'QUESTION', label: 'Другой вопрос' },
]

export function FeedbackForm() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = event.currentTarget
    const payload = Object.fromEntries(new FormData(form).entries())

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Не удалось отправить обращение')
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
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-3 text-emerald-600" size={28} />
        <p className="font-medium text-emerald-900">Обращение отправлено</p>
        <p className="mt-1 text-sm text-emerald-700">
          Мы свяжемся с вами по указанной почте. Обычно отвечаем в течение нескольких рабочих дней.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
        >
          Написать ещё раз
        </button>
      </div>
    )
  }

  const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const label = 'mb-1 block text-sm font-medium text-slate-700'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className={label} htmlFor="fb-topic">Тема обращения</label>
        <select id="fb-topic" name="topic" defaultValue="QUESTION" className={input}>
          {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="fb-name">Имя <span className="text-red-500">*</span></label>
          <input id="fb-name" name="name" required maxLength={120} className={input} placeholder="Иванов Иван" />
        </div>
        <div>
          <label className={label} htmlFor="fb-email">Email <span className="text-red-500">*</span></label>
          <input id="fb-email" name="email" type="email" required maxLength={160} className={input} placeholder="name@university.kz" />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="fb-org">Организация</label>
        <input id="fb-org" name="organization" maxLength={200} className={input} placeholder="Вуз или компания" />
      </div>

      <div>
        <label className={label} htmlFor="fb-message">Сообщение <span className="text-red-500">*</span></label>
        <textarea
          id="fb-message" name="message" required rows={5} maxLength={4000}
          className={`${input} resize-none`}
          placeholder="Опишите вопрос или что нужно сделать"
        />
      </div>

      {/* Ловушка для спам-ботов: люди это поле не видят */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true" className="hidden"
      />

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {loading ? 'Отправка…' : 'Отправить обращение'}
      </button>

      <p className="text-xs text-slate-400">
        Отправляя обращение, вы соглашаетесь на обработку указанных контактных данных
        для ответа на ваш запрос.
      </p>
    </form>
  )
}
