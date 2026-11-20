import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function AdminLoading() {
  const lang = await getRequestLang()
  return (
    <div className="flex items-center justify-center py-32">
      <div
        role="status"
        aria-label={t('system', 'loading', lang)}
        className="w-7 h-7 border-[2.5px] border-slate-200 border-t-blue-600 rounded-full animate-spin"
      />
    </div>
  )
}
