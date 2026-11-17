'use client'

import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Lang } from '@/lib/i18n'
import { translations } from '@/lib/i18n'

interface LangContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (section: string, key: string) => string
}

const LangContext = createContext<LangContextType>({
  lang: 'ru',
  setLang: () => {},
  t: (_s, k) => k,
})

export function LangProvider({ children, initialLang = 'ru' }: { children: React.ReactNode; initialLang?: Lang }) {
  // Начальный язык отдаёт сервер по cookie 'lang' — первый рендер совпадает
  // с SSR, русская вспышка при кэшированном казахском не возникает.
  const [lang, setLangState] = useState<Lang>(initialLang)
  const router = useRouter()

  function setLang(l: Lang) {
    setLangState(l)
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.lang = l === 'kz' ? 'kk' : 'ru'
    // Серверные компоненты читают язык из cookie — без refresh смена
    // применится только после полной перезагрузки (так и было).
    router.refresh()
  }

  function t(section: string, key: string): string {
    const sec = (translations as Record<string, Record<string, Record<Lang, string>>>)[section]
    return sec?.[key]?.[lang] ?? sec?.[key]?.['ru'] ?? key
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
