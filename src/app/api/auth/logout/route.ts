import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, hashSessionToken } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (token) {
    const session = await prisma.session.findUnique({
      where: { sessionToken: hashSessionToken(token) },
      include: { user: true },
    }).catch(() => null)
    await prisma.session.deleteMany({ where: { sessionToken: hashSessionToken(token) } }).catch(() => null)
    if (session?.user) {
      await audit(session.user, 'LOGOUT', 'session', session.user.id, null,
        { ip: getClientIp(request), userAgent: request.headers.get('user-agent') })
    }
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })

  return response
}
