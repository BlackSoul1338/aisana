import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Введите email и пароль' }, { status: 400 })
    }

    // ── Защита от брутфорса ──────────────────────────────────
    // 20 попыток с одного IP за 15 минут (по любым аккаунтам)
    // и 5 попыток по конкретному email за 15 минут.
    //
    // Лимит по аккаунту НЕ содержит IP: клиент подделывает x-forwarded-for
    // и ротацией заголовка обходил связку IP+email полностью. Ключ по email
    // перебор не обходит — как бы клиент ни подменял заголовки.
    const ip = getClientIp(request)
    const normalizedEmail = String(email).trim().toLowerCase()
    const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000)
    const byAccount = rateLimit(`login:acc:${normalizedEmail}`, 5, 15 * 60 * 1000)
    if (!byIp.ok || !byAccount.ok) {
      const retryAfter = Math.max(byIp.retryAfterSec, byAccount.retryAfterSec)
      return NextResponse.json(
        { error: `Слишком много попыток входа. Повторите через ${Math.ceil(retryAfter / 60)} мин.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user?.password) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    const valid = await bcrypt.compare(String(password), user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Ошибка входа' }, { status: 500 })
  }
}
