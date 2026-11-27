'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'

interface Message {
  id: string
  body: string
  fromBusiness: boolean
  createdAt: string
  sender?: { name: string | null } | null
}

interface Props {
  conversationId: string
  initialMessages: Message[]
  /** Чья это страница: от этого зависит, какие сообщения справа */
  side: 'business' | 'university' | 'moderator'
  businessLabel: string
  universityLabel: string
}

/** Как часто спрашивать сервер о новых сообщениях. */
const POLL_MS = 8000

const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty',
})

/**
 * Лента диалога с полем ответа.
 * Новые сообщения подтягиваются опросом раз в несколько секунд; пока вкладка
 * скрыта, опрос не идёт.
 */
export function ChatThread({ conversationId, initialMessages, side, businessLabel, universityLabel }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const latest = useRef(initialMessages.at(-1)?.createdAt ?? '')

  function append(incoming: Message[]) {
    if (incoming.length === 0) return
    setMessages(prev => {
      const known = new Set(prev.map(message => message.id))
      const fresh = incoming.filter(message => !known.has(message.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
    latest.current = incoming.at(-1)!.createdAt
  }

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return
      try {
        const query = latest.current ? `?after=${encodeURIComponent(latest.current)}` : ''
        const res = await fetch(`/api/conversations/${conversationId}/messages${query}`)
        if (res.ok) append((await res.json()).messages ?? [])
      } catch {
        // Сеть моргнула — следующая попытка через несколько секунд
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [conversationId])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Не удалось отправить сообщение')
      append([data.message])
      setText('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="max-h-[60vh] min-h-[240px] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="text-sm text-slate-400">Сообщений пока нет.</p>}
        {messages.map(message => {
          const mine = side === 'business' ? message.fromBusiness : side === 'university' ? !message.fromBusiness : false
          // Модератор не участник: партнёр слева, вуз справа, у каждой стороны свой цвет
          const right = side === 'moderator' ? !message.fromBusiness : mine
          const bubble = mine
            ? 'bg-blue-600 text-white'
            : side !== 'moderator'
              ? 'bg-slate-100 text-slate-800'
              : message.fromBusiness
                ? 'border border-emerald-200 bg-emerald-50 text-slate-800'
                : 'border border-blue-200 bg-blue-50 text-slate-800'
          return (
            <div key={message.id} className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${bubble}`}>
                <p className={`mb-1 text-xs ${mine ? 'text-blue-100' : 'text-slate-500'}`}>
                  {message.sender?.name || (message.fromBusiness ? businessLabel : universityLabel)}
                  {' · '}
                  {message.fromBusiness ? businessLabel : universityLabel}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                <p className={`mt-1 text-right text-[11px] ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                  {timeFormat.format(new Date(message.createdAt))}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      {side === 'moderator' ? (
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          Вы просматриваете диалог как модератор. Писать в него могут только стороны.
        </p>
      ) : (
        <form onSubmit={send} className="border-t border-slate-100 p-3">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          {/* Поле и кнопка в одной рамке: кнопка в нижней строке справа, на любой ширине */}
          <div className="rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e) }}
              rows={2}
              maxLength={4000}
              placeholder="Сообщение"
              className="block w-full resize-none rounded-t-lg bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
            <div className="flex items-center justify-end gap-3 px-2 pb-2">
              <span className="hidden text-xs text-slate-400 sm:inline">Ctrl+Enter — отправить</span>
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Отправить
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
