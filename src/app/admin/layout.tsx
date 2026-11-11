import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  FolderKanban,
  LayoutDashboard,
  Mic,
  Settings,
  Upload,
  Users,
  ScrollText, MessageSquare } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { canManageUsers, requireUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Администратор',
  EDITOR: 'Редактор',
  UNIVERSITY_REP: 'Представитель вуза',
  VIEWER: 'Просмотр',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser('/admin')

  const adminLinks = [
    { href: '/admin', label: 'Обзор', icon: LayoutDashboard, show: true },
    { href: '/admin/universities', label: 'Вузы', icon: Building2, show: canModerate(user) },
    { href: '/admin/projects', label: 'Проекты', icon: FolderKanban, show: user.role !== UserRole.VIEWER },
    { href: '/admin/import', label: 'Импорт', icon: Upload, show: user.role !== UserRole.VIEWER },
    { href: '/admin/hearings', label: 'Заслушивания', icon: Mic, show: canModerate(user) },
    { href: '/admin/feedback', label: 'Обращения', icon: MessageSquare, show: canModerate(user) },
    { href: '/admin/users', label: 'Пользователи', icon: Users, show: canManageUsers(user) },
    { href: '/admin/audit', label: 'Журнал действий', icon: ScrollText, show: user.role === UserRole.ADMIN },
  ].filter(link => link.show)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-60 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Settings size={14} className="text-white" />
          </div>
          <span className="font-semibold text-slate-700 text-sm">Администрирование</span>
        </div>

        <Link
          href="/"
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors font-medium"
        >
          <ArrowLeft size={14} />
          На сайт
        </Link>

        <nav className="lg:flex-1 p-3 flex lg:flex-col gap-1 lg:gap-0 lg:space-y-0.5 overflow-x-auto">
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm whitespace-nowrap shrink-0"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-slate-50">
            <p className="text-sm font-medium text-slate-700 truncate">{user.name || user.email}</p>
            <p className="text-xs text-slate-400 truncate">
              {ROLE_LABELS[user.role]}
              {user.university?.shortName ? ` · ${user.university.shortName}` : ''}
            </p>
          </div>

          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
