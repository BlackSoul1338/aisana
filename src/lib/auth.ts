import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canModerate } from '@/lib/publication'

export const SESSION_COOKIE = 'ai_map_kz_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
type ApiAuthResult = { user: AuthUser; response: null } | { user: null; response: NextResponse }

const WRITE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP]

function isExpired(expires: Date) {
  return expires.getTime() <= Date.now()
}

async function findUserByToken(token?: string) {
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: {
          university: {
            select: { id: true, name: true, shortName: true },
          },
        },
      },
    },
  })

  if (!session) return null

  if (isExpired(session.expires)) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null)
    return null
  }

  return session.user
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  return findUserByToken(cookieStore.get(SESSION_COOKIE)?.value)
}

export async function getCurrentUserFromRequest(request: NextRequest) {
  return findUserByToken(request.cookies.get(SESSION_COOKIE)?.value)
}

export async function requireUser(nextPath = '/admin') {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return user
}

export async function requireRole(roles: UserRole[], nextPath = '/admin') {
  const user = await requireUser(nextPath)
  if (!roles.includes(user.role)) redirect('/admin')
  return user
}

export function canManageUsers(user: { role: UserRole }) {
  return user.role === UserRole.ADMIN
}

export function canWriteContent(user: { role: UserRole }) {
  return WRITE_ROLES.includes(user.role)
}

export function canAccessUniversity(user: { role: UserRole; universityId?: string | null }, universityId: string) {
  if (canModerate(user)) return true
  return user.role === UserRole.UNIVERSITY_REP && user.universityId === universityId
}

export async function requireApiUser(request: NextRequest): Promise<ApiAuthResult> {
  const user = await getCurrentUserFromRequest(request)
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 }) }
  }

  return { user, response: null }
}

export async function requireApiRole(request: NextRequest, roles: UserRole[]): Promise<ApiAuthResult> {
  const { user, response } = await requireApiUser(request)
  if (response) return { user: null, response }

  if (!roles.includes(user.role)) {
    return { user: null, response: NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 }) }
  }

  return { user, response: null }
}
