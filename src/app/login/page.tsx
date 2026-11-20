import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { getCurrentUser } from '@/lib/auth'
import { sanitizeNextPath } from '@/lib/file-url'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const user = await getCurrentUser()
  const { next } = await searchParams
  const safeNext = sanitizeNextPath(next)

  if (user) redirect(safeNext)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            AI
          </div>
          <h1 className="text-xl font-bold text-slate-800">Вход в админ-панель</h1>
          <p className="mt-1 text-sm text-slate-500">Карта ИИ-проектов вузов</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm nextPath={safeNext} />
        </div>
      </div>
    </main>
  )
}
