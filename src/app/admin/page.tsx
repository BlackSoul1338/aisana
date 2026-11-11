export const dynamic = 'force-dynamic'

import { PublicationStatus, UserRole } from '@prisma/client'
import Link from 'next/link'
import { ArrowRight, Building2, ClipboardCheck, FolderKanban, Mic, Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { canModerate, PUBLISHED_ONLY } from '@/lib/publication'
import { ReindexButton } from '@/components/admin/ReindexButton'
import { formatDate } from '@/lib/utils'

export default async function AdminPage() {
  const user = await requireUser('/admin')
  // VIEWER не имеет права видеть черновики чужих вузов: показываем ему
  // только опубликованное. Представитель вуза — проекты своего вуза.
  const projectWhere = user.role === UserRole.UNIVERSITY_REP
    ? { universityId: user.universityId || '__none__' }
    : canModerate(user) ? {} : PUBLISHED_ONLY
  const hearingWhere = user.role === UserRole.UNIVERSITY_REP
    ? { project: { universityId: user.universityId || '__none__' } }
    : canModerate(user) ? {} : { project: PUBLISHED_ONLY }

  const [universities, projects, hearings, awaitingReview] = await Promise.all([
    canModerate(user) ? prisma.university.count() : Promise.resolve(user.universityId ? 1 : 0),
    prisma.project.count({ where: projectWhere }),
    prisma.hearing.count({ where: hearingWhere }),
    // Очередь модерации: сколько проектов ждёт проверки
    prisma.project.count({ where: { ...projectWhere, publication: PublicationStatus.REVIEW } }),
  ])

  const recentProjects = await prisma.project.findMany({
    where: projectWhere,
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { university: true },
  })

  const recentHearings = await prisma.hearing.findMany({
    where: hearingWhere,
    take: 5,
    orderBy: { date: 'desc' },
    include: { project: { include: { university: true } } },
  })

  const quickActions = [
    canModerate(user)
      ? { href: '/admin/universities/new', label: 'Добавить вуз' }
      : null,
    user.role !== UserRole.VIEWER
      ? { href: '/admin/projects/new', label: 'Добавить проект' }
      : null,
    user.role !== UserRole.VIEWER
      ? { href: '/admin/import', label: 'Импорт из Excel' }
      : null,
    canModerate(user)
      ? { href: '/admin/hearings/new', label: 'Добавить заслушивание' }
      : null,
  ].filter(Boolean) as { href: string; label: string }[]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Обзор</h1>
        {canModerate(user) && <ReindexButton />}
      </div>

      {canModerate(user) && awaitingReview > 0 && (
        <Link href="/admin/projects?publication=REVIEW">
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <ClipboardCheck size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">
                Ждут проверки: {awaitingReview}
              </p>
              <p className="text-xs text-amber-700">
                Проекты вузов не появятся на портале, пока вы их не опубликуете
              </p>
            </div>
            <ArrowRight size={16} className="ml-auto shrink-0 text-amber-600" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Вузов', value: universities, icon: Building2, href: '/admin/universities', color: 'text-blue-600 bg-blue-50', show: canModerate(user) },
          { label: 'Проектов', value: projects, icon: FolderKanban, href: '/admin/projects', color: 'text-violet-600 bg-violet-50', show: true },
          { label: 'Заслушиваний', value: hearings, icon: Mic, href: '/admin/hearings', color: 'text-emerald-600 bg-emerald-50', show: canModerate(user) },
        ].filter(item => item.show).map(item => (
          <Link key={item.label} href={item.href}>
            <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all">
              <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center mb-3`}>
                <item.icon size={18} />
              </div>
              <div className="text-2xl font-bold text-slate-800">{item.value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{item.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {quickActions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {quickActions.map(action => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 justify-center py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all"
            >
              <Plus size={15} />
              {action.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Последние проекты</h2>
            <Link href="/admin/projects" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Все <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentProjects.map(project => (
              <div key={project.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <Link href={`/admin/projects/${project.id}/edit`} className="text-sm font-medium text-slate-700 hover:text-blue-600 truncate block">
                    {project.title}
                  </Link>
                  <p className="text-xs text-slate-400">{project.university.shortName || project.university.name}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0 ml-2">{formatDate(project.createdAt)}</span>
              </div>
            ))}
            {recentProjects.length === 0 && <p className="text-sm text-slate-400">Нет проектов</p>}
          </div>
        </div>

        {canModerate(user) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700">Последние заслушивания</h2>
              <Link href="/admin/hearings" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Все <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {recentHearings.map(hearing => (
                <div key={hearing.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/admin/hearings/${hearing.id}/edit`} className="text-sm font-medium text-slate-700 hover:text-blue-600 truncate block">
                      {hearing.project.title}
                    </Link>
                    <p className="text-xs text-slate-400">{hearing.project.university.shortName}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">{formatDate(hearing.date)}</span>
                </div>
              ))}
              {recentHearings.length === 0 && <p className="text-sm text-slate-400">Нет заслушиваний</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
