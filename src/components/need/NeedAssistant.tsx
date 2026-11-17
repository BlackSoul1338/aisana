'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Building2, CheckCircle2, Circle, Loader2, Send, Sparkles } from 'lucide-react'
import { FIELD_TITLES, MAX_TURNS, READY_THRESHOLD } from '@/lib/need-builder/readiness'
import { QUICK_REPLIES } from '@/lib/need-builder/questions'
import type { FieldChange } from '@/lib/need-builder/diff'
import type { NeedMatch } from '@/lib/need-builder/match'
import type { NeedView, TurnResult } from '@/lib/need-builder/service'

const GREETING =
  'Опишите своими словами, какую задачу компании вы хотите решить с помощью ИИ: какой процесс, что не устраивает сейчас, какой результат нужен. Я задам уточняющие вопросы и подберу решения университетов из витрины.'

const STATUS_ICON = {
  ok: <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />,
  weak: <AlertCircle size={15} className="shrink-0 text-amber-500" />,
  missing: <Circle size={15} className="shrink-0 text-slate-300" />,
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * Помощник подбора: чат слева, живая карточка потребности и подборка справа
 * (раскладка из Business Challenge Builder в Sana, вёрстка — классами AiSana).
 */
export function NeedAssistant({ initialNeed, initialMatches, aiEnabled }: {
  initialNeed: NeedView | null
  initialMatches: NeedMatch[]
  /** false — на сервере нет ключа Gemini: диалог недоступен, отправка оператору работает */
  aiEnabled: boolean
}) {
  const router = useRouter()
  const [need, setNeed] = useState(initialNeed)
  const [matches, setMatches] = useState(initialMatches)
  const [changes, setChanges] = useState<FieldChange[]>([])
  const [text, setText] = useState('')
  // Сообщение показывается сразу, пока модель разбирает ответ
  const [pending, setPending] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [justSent, setJustSent] = useState(false)
  const chatEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [need?.messages.length, loading])

  const collecting = !need || need.status === 'COLLECTING'
  const turnsLeft = need ? MAX_TURNS - need.turnCount : MAX_TURNS
  const canWrite = aiEnabled && collecting && turnsLeft > 0

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const message = text.trim()
    if (message.length < 2 || loading) return
    setLoading(true)
    setPending(message)
    setText('')
    setError('')
    try {
      const res = await fetch(need ? `/api/need/${need.id}/turn` : '/api/need', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить сообщение')
      const result = data as TurnResult
      setNeed(result.need)
      setMatches(result.matches)
      setChanges(result.changes)
      if (!need) router.replace(`/business/assistant/${result.need.id}`)
    } catch (err: any) {
      setError(err.message)
      setText(message) // текст не теряется: его можно поправить и отправить снова
    } finally {
      setLoading(false)
      setPending('')
    }
  }

  const gaps = need?.fields.filter(f => f.status !== 'ok').map(f => f.key) ?? []
  const quickReplies = gaps.flatMap(key => QUICK_REPLIES[key] ?? []).slice(0, 4)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Диалог */}
      <div className="flex min-h-[560px] flex-col rounded-xl border border-slate-200 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: '65vh' }}>
          <Bubble role="assistant" text={GREETING} />
          {need?.messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
          {pending && <Bubble role="user" text={pending} />}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" /> Разбираю ответ…
            </div>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="border-t border-slate-100 p-4">
          {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {canWrite ? (
            <form onSubmit={submit} className="space-y-2">
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {quickReplies.map(reply => (
                    <button
                      key={reply} type="button"
                      onClick={() => setText(prev => (prev.trim() ? `${prev.trim()} ${reply}` : reply))}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={2000}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e) }}
                className={`${input} resize-none`}
                placeholder={need ? 'Ответьте на вопросы — можно одним сообщением' : 'Например: мы сеть клиник, хотим по рентгеновским снимкам находить ранние признаки патологий…'}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Текст обрабатывает модель Google Gemini — не указывайте персональные данные.
                  {need ? ` Осталось сообщений: ${turnsLeft}.` : ''}
                </p>
                <button
                  type="submit" disabled={loading || text.trim().length < 2}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Отправить
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              {!aiEnabled && collecting
                ? <>Помощник подбора сейчас недоступен. Выберите решение в <Link href="/business/solutions" className="text-blue-600 hover:underline">витрине решений</Link> и отправьте запрос из карточки проекта{need ? ' или отправьте эту потребность оператору' : ''}.</>
                : collecting
                ? `Достигнут предел в ${MAX_TURNS} сообщений — отправьте запрос оператору, он уточнит остальное.`
                : <>Потребность отправлена оператору. Статус — в разделе <Link href="/business/requests" className="text-blue-600 hover:underline">«Мои запросы»</Link>.</>}
            </p>
          )}
        </div>
      </div>

      {/* Карточка потребности и подборка */}
      <div className="space-y-4">
        <NeedCard need={need} changes={changes} />
        <Matches matches={matches} hasNeed={Boolean(need)} />
        {justSent ? <SentCard /> : need && collecting && (
          <SendPanel need={need} matches={matches} onSent={() => { setJustSent(true); setNeed({ ...need, status: 'SENT' }) }} />
        )}
      </div>
    </div>
  )
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const mine = role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
        {text}
      </div>
    </div>
  )
}

function NeedCard({ need, changes }: { need: NeedView | null; changes: FieldChange[] }) {
  const readiness = need?.readiness ?? 0
  const ready = readiness >= READY_THRESHOLD
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-800">Карточка потребности</h2>
        <span className={`text-sm font-semibold ${ready ? 'text-emerald-600' : 'text-slate-500'}`}>{readiness}%</span>
      </div>
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${ready ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${readiness}%` }} />
      </div>
      <p className="mb-4 text-xs text-slate-400">
        {ready ? 'Описания достаточно для запроса оператору.' : `Полнота описания; от ${READY_THRESHOLD}% подбор заметно точнее.`}
      </p>

      {need?.fields.length ? (
        <ul className="space-y-2.5">
          {need.fields.map(field => {
            const change = changes.find(c => c.field === field.key)
            return (
              <li key={field.key} className="flex gap-2">
                <span className="mt-0.5">{STATUS_ICON[field.status]}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {FIELD_TITLES[field.key]}
                    {change && change.delta > 0 && (
                      <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold normal-case text-emerald-600">+{change.delta}</span>
                    )}
                  </p>
                  <p className={`text-sm ${field.status === 'missing' ? 'text-slate-400' : 'text-slate-700'}`}>{field.value}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">Поля заполнятся после первого сообщения. В карточку попадает только то, что вы написали сами.</p>
      )}
    </div>
  )
}

function Matches({ matches, hasNeed }: { matches: NeedMatch[]; hasNeed: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
        <Sparkles size={16} className="text-blue-600" /> Подходящие решения
      </h2>
      {matches.length ? (
        <ul className="space-y-3">
          {matches.map(match => (
            <li key={match.id}>
              <Link href={`/projects/${match.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">
                {match.title}
              </Link>
              <p className="flex items-center gap-1 text-xs text-slate-400"><Building2 size={11} /> {match.university}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{match.reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">
          {hasNeed
            ? 'Пока ничего близкого в витрине. Уточните задачу или отправьте запрос оператору — он подберёт решение сам.'
            : 'Подборка появится после первого сообщения.'}
        </p>
      )}
      <Link href="/business/solutions" className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline">
        Все решения для бизнеса →
      </Link>
    </div>
  )
}

function SentCard() {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={24} />
      <p className="text-sm font-medium text-emerald-900">Запрос отправлен</p>
      <p className="mt-1 text-xs text-emerald-700">Оператор AiSana проверит его и свяжется с вами по почте.</p>
      <Link href="/business/requests" className="mt-3 inline-block text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
        Мои запросы
      </Link>
    </div>
  )
}

function SendPanel({ need, matches, onSent }: { need: NeedView; matches: NeedMatch[]; onSent: () => void }) {
  const [projectId, setProjectId] = useState('')
  const [comment, setComment] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/need/${need.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || undefined, comment: comment || undefined, contactPhone: phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить запрос')
      onSent()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-800">Запрос оператору</h2>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="need-project">Решение</label>
        <select id="need-project" value={projectId} onChange={e => setProjectId(e.target.value)} className={input}>
          <option value="">Подберёт оператор</option>
          {matches.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </div>
      <textarea
        value={comment} onChange={e => setComment(e.target.value)} rows={2} maxLength={2000}
        className={`${input} resize-none`} placeholder="Комментарий (необязательно)"
      />
      <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} className={input} placeholder="Телефон (необязательно)" />
      <button
        type="button" onClick={send} disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Отправить оператору
      </button>
      <p className="text-xs text-slate-400">
        Оператор и вуз увидят сводку карточки (только подтверждённые вами сведения), а не переписку.
        Контакты из вашей учётной записи передаются вместе с запросом.
      </p>
    </div>
  )
}
