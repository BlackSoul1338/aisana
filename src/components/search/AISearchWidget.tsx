'use client'

import { useState, useEffect } from 'react'
import { Search, Sparkles, Building2, ArrowRight, Loader2, AlertCircle, X } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { useLang } from '@/context/LangContext'

const EXAMPLES = [
  'Проекты в области нефтегазовой и энергетической отрасли',
  'ИИ для автоматической проверки знаний студентов',
  'Компьютерное зрение в медицине и здравоохранении',
  'Чат-боты для образования на казахском языке',
  'Машинное обучение для анализа данных в науке',
  'Робототехника и автоматизация производства',
]

const STORAGE_KEY = 'ai-search-state-v1'

interface AIResult {
  id: string
  title: string
  description: string
  status: string
  category: string
  university: { name: string; shortName?: string | null; region: { name: string } }
  technologies: { name: string }[]
}

interface StoredState {
  query: string
  searched: string
  results: AIResult[] | null
  aiSummary: string | null
  matchReasons: Record<string, string>
  aiAvailable: boolean
}

function loadStoredState(): StoredState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveStoredState(state: StoredState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore quota errors */ }
}

export function AISearchWidget() {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AIResult[] | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [matchReasons, setMatchReasons] = useState<Record<string, string>>({})
  const [aiAvailable, setAiAvailable] = useState(true)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = loadStoredState()
    if (stored) {
      setQuery(stored.query)
      setSearched(stored.searched)
      setResults(stored.results)
      setAiSummary(stored.aiSummary)
      setMatchReasons(stored.matchReasons || {})
      setAiAvailable(stored.aiAvailable !== false)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveStoredState({ query, searched, results, aiSummary, matchReasons, aiAvailable })
  }, [query, searched, results, aiSummary, matchReasons, aiAvailable, hydrated])

  async function doSearch(q?: string) {
    const searchQuery = q || query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    setAiSummary(null)
    setMatchReasons({})
    setAiAvailable(true)
    setSearched(searchQuery)
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка поиска')
      setResults(data.results)
      setAiSummary(data.aiSummary || null)
      setMatchReasons(data.matchReasons || {})
      setAiAvailable(data.aiAvailable !== false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function clearSearch() {
    setResults(null)
    setAiSummary(null)
    setMatchReasons({})
    setAiAvailable(true)
    setQuery('')
    setSearched('')
    setError('')
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Например: проекты для автоматизации приёмной комиссии..."
              className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 focus:border-blue-500 rounded-xl text-sm bg-white focus:outline-none transition-colors"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => doSearch()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white px-5 py-3.5 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Найти
          </button>
        </div>
      </div>

      {results === null && !loading && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Примеры запросов</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); doSearch(ex) }}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 text-slate-600 rounded-full text-xs transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-sm">Идёт поиск по базе данных...</p>
        </div>
      )}

      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Ошибка ИИ-поиска</p>
            <p className="text-xs text-red-600 mt-1 break-words">{error}</p>
          </div>
        </div>
      )}

      {results !== null && !loading && (
        <div>
          {aiSummary && (
            <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/80 p-4 text-sm text-violet-900 shadow-sm">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <Sparkles size={16} className="text-violet-600" />
                AI-резюме
              </div>
              <p className="leading-6 text-violet-800">{aiSummary}</p>
            </div>
          )}

          {!aiAvailable && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
              {t('search', 'aiUnavailableBanner')}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">
              По запросу <span className="font-semibold text-slate-800">«{searched}»</span> найдено{' '}
              <span className="font-bold text-blue-600">{results.length}</span> проектов
            </p>
            {results.length > 0 && (
              <button onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
                Новый поиск
              </button>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Подходящих проектов не найдено</p>
              <p className="text-sm mt-1">Попробуйте переформулировать запрос</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((project, i) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold shrink-0">
                            {i + 1}
                          </span>
                          <h3 className="font-semibold text-slate-800 text-sm truncate">{project.title}</h3>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-2">
                          <StatusBadge status={project.status as any} size="sm" />
                          <CategoryBadge category={project.category as any} />
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                          <Building2 size={12} />
                          <span>{project.university.shortName || project.university.name}</span>
                          <span>·</span>
                          <span>{project.university.region.name}</span>
                        </div>

                        {project.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.technologies.slice(0, 5).map(t => (
                              <span key={t.name} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px]">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {matchReasons[project.id] && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-2">
                            <Sparkles size={13} className="text-violet-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-violet-700 leading-5">{matchReasons[project.id]}</p>
                          </div>
                        )}
                      </div>
                      <ArrowRight size={16} className="text-slate-300 shrink-0 mt-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
