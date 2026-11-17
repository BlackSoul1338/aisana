'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useLang } from '@/context/LangContext'

interface Props {
  title?: string
  description?: string
  /** Показать кнопку входа (для неавторизованных) вместо ссылки на главную */
  showLogin?: boolean
  nextPath?: string
}

/** Единый экран «Нет доступа» для закрытых разделов портала. */
export function AccessDenied({
  title,
  description,
  showLogin = false,
  nextPath,
}: Props) {
  const { t } = useLang()
  const heading = title ?? t('access', 'title')
  const text = description ?? t('access', 'desc')
  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <Lock size={28} className="text-slate-400" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-700">{heading}</h1>
        <p className="mb-6 max-w-sm text-sm text-slate-400">{text}</p>
        {showLogin ? (
          <Link
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('login', 'signIn')}
          </Link>
        ) : (
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300"
          >
            {t('system', 'notFoundHome')}
          </Link>
        )}
      </div>
    </PageLayout>
  )
}
