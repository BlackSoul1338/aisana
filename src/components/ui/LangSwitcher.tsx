'use client'

import { useLang } from '@/context/LangContext'
import { LANGUAGES } from '@/lib/i18n'

export function LangSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { lang, setLang } = useLang()

  return (
    <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${variant === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            lang === l.code
              ? 'bg-white text-blue-700 shadow-sm'
              : variant === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
