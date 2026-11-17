// Страница зависит от пользователя (cookies) — всегда per-request
export const dynamic = 'force-dynamic'

import { PageLayout } from '@/components/layout/PageLayout'
import { AISearchWidget } from '@/components/search/AISearchWidget'
import { getCurrentUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { AccessDenied } from '@/components/layout/AccessDenied'
import { t } from '@/lib/i18n'
import { getRequestLang } from '@/lib/i18n-server'

export default async function AISearchPage() {
  const user = await getCurrentUser()
  const lang = await getRequestLang()

  // ИИ-поиск расходует платную квоту Gemini на каждый запрос,
  // поэтому доступен только сотрудникам оператора портала (ADMIN и EDITOR).
  if (!user) {
    return (
      <AccessDenied
        title={t('aiAccess', 'authRequired', lang)}
        description={t('aiAccess', 'authDesc', lang)}
        showLogin
        nextPath="/ai-search"
      />
    )
  }

  if (!canModerate(user)) {
    return (
      <AccessDenied description={t('aiAccess', 'modOnly', lang)} />
    )
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            {t('search', 'badge', lang)}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            {t('search', 'pageTitle', lang)}
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            {t('search', 'pageSubtitle', lang)}
          </p>
        </div>
        <AISearchWidget />
      </div>
    </PageLayout>
  )
}
