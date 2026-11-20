'use client'

import Link from 'next/link'
import { Navbar } from './Navbar'
import { useLang } from '@/context/LangContext'

export function PageLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="container max-w-7xl mx-auto px-4">
          {/* kz-строки длиннее ru: до xl — согласованный центрированный столбик,
              от xl — ряд. Точки слева скрыты до xl, иначе «повисают» в столбике. */}
          <div className="flex flex-col items-center gap-2 text-center text-xs text-slate-400 xl:flex-row xl:items-center xl:justify-between xl:text-left">
            <div className="flex flex-col items-center gap-1 xl:flex-row xl:items-center xl:gap-3">
              <p>{t('footer', 'copyright')}</p>
              <span className="hidden xl:inline text-slate-300">·</span>
              <p className="text-slate-300">{t('footer', 'portal')}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link href="/contacts" className="hover:text-slate-600 transition-colors">
                {t('footer', 'contacts')}
              </Link>
              <span className="text-slate-300">·</span>
              <a
                href="/docs/instrukciya-dlya-vuzov.docx"
                className="hover:text-slate-600 transition-colors"
              >
                {t('footer', 'instruction')}
              </a>
              <span className="text-slate-300">·</span>
              <p>
                {t('footer', 'madeBy')}:{' '}
                <span className="text-slate-500 font-medium">Дюсенов Адилет Болатулы</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
