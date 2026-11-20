'use client'

import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/context/LangContext'

/**
 * Кнопка «Назад» для страниц редактирования в админке.
 * Использует историю браузера (history.back) — возвращает на список
 * с сохранёнными фильтрами, сортировкой и номером страницы.
 * Если истории нет (страницу открыли по прямой ссылке) или JS
 * не отработал — обычный переход по href на список.
 */
export function BackButton({ fallback, label }: { fallback: string; label?: string }) {
  const { t } = useLang()
  const text = label ?? t('admin', 'back')
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const cameFromSite =
      typeof document !== 'undefined' &&
      document.referrer.startsWith(window.location.origin)

    if (window.history.length > 1 && cameFromSite) {
      e.preventDefault()
      window.history.back()
    }
    // иначе — нативный переход по href
  }

  return (
    <a
      href={fallback}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
    >
      <ArrowLeft size={14} /> {text}
    </a>
  )
}
