import Link from 'next/link'
import { MapPin, ArrowLeft, Search } from 'lucide-react'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function NotFound() {
  const lang = await getRequestLang()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
        <MapPin size={28} className="text-blue-500" />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('system', 'notFoundTitle', lang)}</h1>
      <p className="text-slate-500 max-w-sm mb-8">
        {t('system', 'notFoundText', lang)}
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft size={15} /> {t('system', 'notFoundHome', lang)}
        </Link>
        <Link
          href="/projects"
          className="flex items-center gap-2 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-600 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Search size={15} /> {t('system', 'notFoundProjects', lang)}
        </Link>
      </div>
    </div>
  )
}
