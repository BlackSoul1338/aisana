'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { useLang } from '@/context/LangContext'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLang()
  useEffect(() => {
    // Log to console for now — swap for a real error tracker (Sentry etc.) later
    console.error('Unhandled app error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-5">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{t('system', 'errorTitle')}</h1>
      <p className="text-slate-500 max-w-md mb-2">
        {t('system', 'errorText')}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 mb-8 font-mono">{t('system', 'errorCode')}: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <RotateCcw size={15} /> {t('system', 'tryAgain')}
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Home size={15} /> {t('system', 'notFoundHome')}
        </Link>
      </div>
    </div>
  )
}
