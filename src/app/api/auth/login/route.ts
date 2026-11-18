import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { DEVICE_COOKIE, DEVICE_MAX_AGE_SECONDS, isTrustedDevice, trustDevice } from '@/lib/trusted-devices'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, hashSessionToken } from '@/lib/auth'
import { resetRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { loginSchema, parseBody } from '@/lib/schemas'

// Статический dummy bcrypt-хэш для защиты от timing attacks при переборе аккаунтов
const DUMMY_HASH = '$2a$10$vcfGxKKibj57yU2Xf2.1XOpbQ1XHc/HCQQbNh6Yht6wGegcGOHNwq'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(loginSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { email, password } = parsed.data

    // ── Защита от брутфорса ──────────────────────────────────
    // 20 попыток с одного IP за 15 минут (по любым аккаунтам)
    // и 5 попыток по конкретному email за 15 минут.
    //
    // Лимит по аккаунту НЕ содержит IP: клиент подделывает x-forwarded-for
    // и ротацией заголовка обходил связку IP+email полностью. Ключ по email
    // перебор не обходит — как бы клиент ни подменял заголовки.
    //
    // Браузер, из которого уже входили в эту учётку, считается в своей
    // корзине: пять чужих неверных паролей не блокируют вход владельцу
    // с его устройства (см. trusted-devices.ts).
    const ip = getClientIp(request)
    const normalizedEmail = String(email).trim().toLowerCase()
    const deviceToken = request.cookies.get(DEVICE_COOKIE)?.value
    const accountKey = isTrustedDevice(deviceToken, normalizedEmail)
      ? `login:acc:${normalizedEmail}:device:${deviceToken}`
      : `login:acc:${normalizedEmail}`
    const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000)
    const byAccount = rateLimit(accountKey, 5, 15 * 60 * 1000)
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

    const valid = await bcrypt.compare(String(password), user?.password || DUMMY_HASH)
    if (!user?.password || !valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })
    }

    // Лимит по email считает только неудачные попытки. Иначе общая учётка
    // (например, VIEWER на отдел) блокировалась бы после пяти успешных
    // входов за 15 минут с разных машин.
    resetRateLimit(accountKey)

    // В базу уходит sha256 токена, в cookie — сам токен: чужой дамп сессий не даёт входа
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

    await prisma.session.create({
      data: {
        sessionToken: hashSessionToken(sessionToken),
        userId: user.id,
        expires,
      },
    })

    await audit(user, 'LOGIN', 'session', user.id, null,
      { ip, userAgent: request.headers.get('user-agent') })

    // Отметка о входе: по ней в админке видно, кто из вузов ни разу не заходил.
    // Не критично для входа — ошибка записи не должна его ломать.
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(error => console.error('Failed to store last login', error))

    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    // Cookie устройства переживает выход из учётки: в этом её смысл
    response.cookies.set(DEVICE_COOKIE, trustDevice(deviceToken, normalizedEmail), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth/login',
      maxAge: DEVICE_MAX_AGE_SECONDS,
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Ошибка входа' }, { status: 500 })
  }
}
