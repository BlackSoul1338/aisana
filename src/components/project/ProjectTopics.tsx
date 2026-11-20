'use client'

import { Sparkles } from 'lucide-react'
import { useLang } from '@/context/LangContext'

interface Topic {
  topic: string
  score: number
  explanation: string
  signals?: string[]
}

function barColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500'
  if (score >= 45) return 'bg-blue-500'
  return 'bg-slate-400'
}

/**
 * Тематические направления проекта с коэффициентом релевантности
 * и объяснением, почему проект отнесён к направлению.
 */
export function ProjectTopics({ topics, labels }: { topics: Topic[]; labels: Record<string, string> }) {
  const { t } = useLang()
  if (!topics.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-violet-500" />
        <h2 className="font-semibold text-slate-800">{t('project', 'topicsTitle')}</h2>
        <span className="text-xs text-slate-400">{t('project', 'topicsAuto')}</span>
      </div>

      <div className="space-y-4">
        {topics.map(topic => (
          <div key={topic.topic}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                {labels[topic.topic] ?? topic.topic}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">
                {topic.score}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barColor(topic.score)}`} style={{ width: `${topic.score}%` }} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{topic.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
