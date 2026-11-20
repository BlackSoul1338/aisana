'use client'

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useLang } from '@/context/LangContext'

type ThemeMode = 'system' | 'light' | 'dark'

const OPTIONS = [
  { mode: 'system' as const, icon: Monitor, key: 'system' },
  { mode: 'light' as const, icon: Sun, key: 'light' },
  { mode: 'dark' as const, icon: Moon, key: 'dark' },
]

/** Применяет режим к <html>: system следует prefers-color-scheme. */
function applyMode(mode: ThemeMode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function ThemeSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { t } = useLang()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'system' || saved === 'light' || saved === 'dark') setModeState(saved)
  }, [])

  // system-режим должен следовать за ОС, как inline-скрипт в layout
  useEffect(() => {
    if (mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyMode('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  function choose(next: ThemeMode) {
    setModeState(next)
    try {
      localStorage.setItem('theme', next)
    } catch {
      // приватный режим — тема просто не сохранится между визитами
    }
    applyMode(next)
  }

  return (
    <div
      className={`flex items-center gap-0.5 rounded-lg p-0.5 ${variant === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}
      role="group"
      aria-label={t('theme', 'label')}
    >
      {OPTIONS.map(({ mode: m, icon: Icon, key }) => {
        const active = mode === m
        const label = t('theme', key)
        return (
          <button
            key={m}
            type="button"
            onClick={() => choose(m)}
            aria-pressed={active}
            title={label}
            aria-label={label}
            className={`p-2 rounded-md transition-all ${
              active
                ? 'bg-white text-blue-700 shadow-sm'
                : variant === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
          </button>
        )
      })}
    </div>
  )
}
