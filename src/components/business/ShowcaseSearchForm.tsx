'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Search, Sparkles } from 'lucide-react'
import { INDUSTRIES } from '@/lib/industries'

const STATUSES = [
  { value: 'PILOT', label: 'Пилот' },
  { value: 'IMPLEMENTED', label: 'Внедрено' },
  { value: 'SCALED', label: 'Масштабировано' },
]

interface Props {
  query: string
  industry: string
  status: string
  all: boolean
  topic: string
}

/**
 * Форма поиска витрины.
 *
 * Отправка — переход внутри приложения, а не перезагрузка страницы: форма
 * остаётся на месте, кнопка сразу показывает, что поиск идёт, а результаты
 * подгружаются ниже.
 */
export function ShowcaseSearchForm({ query, industry, status, all, topic }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'search' | 'ai' | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const withAi = submitter?.value === 'ai'
    const form = new FormData(event.currentTarget)

    const params = new URLSearchParams()
    const text = String(form.get('q') ?? '').trim()
    if (text) params.set('q', text)
    for (const name of ['industry', 'status', 'topic']) {
      const value = String(form.get(name) ?? '')
      if (value) params.set(name, value)
    }
    if (form.get('all')) params.set('all', '1')
    if (withAi) params.set('ai', '1')

    setMode(withAi ? 'ai' : 'search')
    const search = params.toString()
    startTransition(() => router.push(search ? `/business?${search}` : '/business'))
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const selectCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto'
  const filtered = Boolean(query || topic || industry || status || all)

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h1 className="text-lg font-bold text-slate-800">Витрина решений</h1>
      <p className="mb-3 mt-1 text-sm text-slate-500">
        Разработки команд казахстанских вузов программы AI-Sana. Решения открыты к совместному пилоту и доработке под задачи вашей организации. Ищите по словам или опишите задачу — ИИ подберёт решения и объяснит выбор.
      </p>
      <textarea name="q" defaultValue={query} rows={2} maxLength={600} className={`${inputCls} resize-none`}
        placeholder="Слова для поиска: чат-бот, распознавание документов. Или задача целиком: каждый день приходит 300 обращений клиентов, нужно определять тему и направлять в отдел" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" value="search" disabled={pending}
          className="inline-flex grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:grow-0">
          {pending && mode === 'search' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Найти
        </button>
        <button type="submit" value="ai" disabled={pending}
          className="inline-flex grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60 sm:grow-0">
          {pending && mode === 'ai' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Подобрать с ИИ
        </button>
        <select name="industry" defaultValue={industry} className={selectCls}>
          <option value="">Все отрасли</option>
          {INDUSTRIES.map(item => <option key={item.value} value={item.value}>{item.ru}</option>)}
        </select>
        <select name="status" defaultValue={status} className={selectCls}>
          <option value="">От пилота и выше</option>
          {STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" name="all" value="1" defaultChecked={all} className="h-4 w-4 rounded" />
          Показывать также идеи и прототипы
        </label>
        {topic && <input type="hidden" name="topic" value={topic} />}
        {filtered && <Link href="/business" className="ml-auto text-sm text-slate-500 hover:text-slate-700">Сбросить</Link>}
      </div>
    </form>
  )
}
