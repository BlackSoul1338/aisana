// Страница зависит от пользователя (cookies) — всегда per-request
export const dynamic = 'force-dynamic'

import { PageLayout } from '@/components/layout/PageLayout'
import { AISearchWidget } from '@/components/search/AISearchWidget'
import { getCurrentUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
import { AccessDenied } from '@/components/layout/AccessDenied'

export default async function AISearchPage() {
  const user = await getCurrentUser()

  // ИИ-поиск расходует платную квоту Gemini на каждый запрос,
  // поэтому доступен только сотрудникам оператора портала (ADMIN и EDITOR).
  if (!user) {
    return (
      <AccessDenied
        title="Требуется авторизация"
        description="ИИ-поиск доступен только авторизованным пользователям."
        showLogin
        nextPath="/ai-search"
      />
    )
  }

  if (!canModerate(user)) {
    return (
      <AccessDenied description="ИИ-поиск доступен только администраторам и редакторам портала. Обычный поиск по проектам — в разделе «Проекты»." />
    )
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            ✦ Поиск проектов
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            Найдите нужный проект
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto">
            Введите ключевые слова — поиск найдёт проекты по базе вузов Казахстана
          </p>
        </div>
        <AISearchWidget />
      </div>
    </PageLayout>
  )
}
