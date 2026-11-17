import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function HomeLoading() {
  const lang = await getRequestLang()
  return (
    <div className="flex flex-col h-screen bg-[#0d1b3e]">
      <div className="h-14 gov-header border-b border-white/10" />
      <div className="flex-1 flex items-center justify-center">
        <div
          role="status"
          aria-label={t('system', 'loading', lang)}
          className="w-7 h-7 border-[2.5px] border-white/15 border-t-white/70 rounded-full animate-spin"
        />
      </div>
    </div>
  )
}
