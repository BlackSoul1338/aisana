export const dynamic = 'force-dynamic'

import { Prisma, UserRole } from '@prisma/client'
import { UserPlus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { formatDate } from '@/lib/datetime'
import { UserCreateForm } from '@/components/users/UserCreateForm'
import { UserEditControls } from '@/components/users/UserEditControls'
import { ListFilters } from '@/components/admin/ListFilters'
import { Pagination } from '@/components/admin/Pagination'

const PAGE_SIZE = 25

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Администратор',
  EDITOR: 'Редактор',
  UNIVERSITY_REP: 'Представитель вуза',
  VIEWER: 'Просмотр',
}

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  EDITOR: 'bg-blue-100 text-blue-700',
  UNIVERSITY_REP: 'bg-violet-100 text-violet-700',
  VIEWER: 'bg-slate-100 text-slate-600',
}

const SORTS: Record<string, Prisma.UserOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  name: { name: 'asc' },
  // Кто заходил недавно — выше; ни разу не входившие — в конце
  login: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
}

interface SearchParams {
  q?: string
  role?: string
  universityId?: string
  login?: string
  sort?: string
  page?: string
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const currentUser = await requireRole([UserRole.ADMIN], '/admin/users')
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)

  const where: Prisma.UserWhereInput = {
    ...(params.role && params.role in ROLE_LABELS ? { role: params.role as UserRole } : {}),
    ...(params.universityId ? { universityId: params.universityId } : {}),
    ...(params.login === 'never' ? { lastLoginAt: null } : {}),
    ...(params.login === 'done' ? { lastLoginAt: { not: null } } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { email: { contains: params.q, mode: 'insensitive' } },
            { university: { name: { contains: params.q, mode: 'insensitive' } } },
            { university: { shortName: { contains: params.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [users, total, totalAll, adminCount, neverCount, universities] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        university: { select: { name: true, shortName: true, _count: { select: { projects: true } } } },
      },
      orderBy: SORTS[params.sort || 'newest'] || SORTS.newest,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
    prisma.user.count(),
    // Считаем по всей базе, а не по странице: от этого зависит запрет удалить последнего админа
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.user.count({ where: { lastLoginAt: null } }),
    prisma.university.findMany({
      select: { id: true, name: true, shortName: true },
      orderBy: { name: 'asc' },
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(params.q || params.role || params.universityId || params.login)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Пользователи ({hasFilters ? `${total} из ${totalAll}` : totalAll})
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Аккаунты для администраторов, редакторов и представителей вузов.
          {neverCount > 0 && <> Без входов: <span className="font-medium text-slate-700">{neverCount}</span>.</>}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Входы до 13.11.2026 восстановлены по сессиям и журналу действий и могут быть неполными.
        </p>
      </div>

      {/* Форма свёрнута: список — главное на странице, а создают аккаунты редко */}
      <details className="group rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-blue-700 hover:bg-slate-50 rounded-xl">
          <UserPlus size={16} />
          Новый пользователь
          <span className="ml-auto text-xs font-normal text-slate-400 group-open:hidden">развернуть</span>
          <span className="ml-auto hidden text-xs font-normal text-slate-400 group-open:inline">свернуть</span>
        </summary>
        <div className="border-t border-slate-100 p-6">
          <UserCreateForm universities={universities} />
        </div>
      </details>

      <ListFilters
        basePath="/admin/users"
        values={params as Record<string, string | undefined>}
        searchPlaceholder="Имя, почта или вуз…"
        filters={[
          {
            name: 'role',
            label: 'Все роли',
            options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            name: 'universityId',
            label: 'Все вузы',
            options: universities.map(u => ({ value: u.id, label: u.shortName || u.name })),
          },
          {
            name: 'login',
            label: 'Любая активность',
            options: [
              { value: 'never', label: 'Без входов' },
              { value: 'done', label: 'Входили' },
            ],
          },
        ]}
        sortOptions={[
          { value: 'newest', label: 'Сначала новые' },
          { value: 'name', label: 'По имени А-Я' },
          { value: 'login', label: 'По последнему входу' },
        ]}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Пользователь</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Роль</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Вуз</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Последний вход</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  {/* У большинства аккаунтов имя не заполнено — тогда главной строкой идёт почта */}
                  <p className="font-medium text-slate-800">{user.name || user.email}</p>
                  {user.name && <p className="text-xs text-slate-400">{user.email}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ROLE_COLORS[user.role]}`}>
                    {ROLE_LABELS[user.role]}
                  </span>
                  {user.id === currentUser.id && (
                    <span className="ml-2 text-[10px] text-slate-400 font-medium">(вы)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {user.university ? (
                    <>
                      <p className="text-slate-600">{user.university.shortName || user.university.name}</p>
                      <p className="text-slate-400">проектов: {user.university._count.projects}</p>
                    </>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap">
                  {user.lastLoginAt
                    ? <span className="text-slate-600">{formatDate(user.lastLoginAt)}</span>
                    : <span className="text-amber-600">нет входов</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <UserEditControls
                    user={{ id: user.id, name: user.name, email: user.email, role: user.role, universityId: user.universityId }}
                    universities={universities}
                    isSelf={user.id === currentUser.id}
                    isLastAdmin={user.role === UserRole.ADMIN && adminCount <= 1}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            {hasFilters ? 'Никого не найдено по заданным фильтрам' : 'Нет пользователей'}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        basePath="/admin/users"
        searchParams={params as Record<string, string | undefined>}
      />
    </div>
  )
}
