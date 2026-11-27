import Link from 'next/link'
import { UserRole } from '@prisma/client'
import { Briefcase, LayoutGrid, ListChecks, MessagesSquare } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { unreadConversations } from '@/lib/business'
import { PageLayout } from '@/components/layout/PageLayout'
import { LogoutButton } from '@/components/auth/LogoutButton'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Кабинет партнёра' }

/**
 * Панель представителя бизнеса: витрина решений, свои запросы и диалоги.
 * Модераторы портала могут открыть её, чтобы увидеть витрину глазами бизнеса.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole([UserRole.BUSINESS, UserRole.ADMIN, UserRole.EDITOR], '/business')
  const unread = await unreadConversations(user)

  const links = [
    { href: '/business', label: 'Витрина решений', icon: LayoutGrid },
    { href: '/business/requests', label: 'Мои задачи', icon: ListChecks },
    { href: '/business/chats', label: 'Диалоги', icon: MessagesSquare, badge: unread },
  ]

  return (
    <PageLayout>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <Briefcase size={16} className="text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{user.organization || 'Кабинет партнёра'}</p>
            <p className="text-xs text-slate-400">{user.name || user.email}</p>
          </div>
        </div>

        {/* На телефоне разделы — отдельной строкой под названием и кнопкой выхода */}
        <nav className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto sm:flex-1">
          {links.map(({ href, label, icon: Icon, badge }) => (
            <Link key={href} href={href}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700">
              <Icon size={14} /> {label}
              {badge ? <span className="rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">{badge}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="w-auto shrink-0 sm:w-36"><LogoutButton /></div>
      </div>

      {children}
    </PageLayout>
  )
}
