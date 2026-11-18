import { NextRequest, NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/auth'
import { rateLimit, refundRateLimit } from '@/lib/rate-limit'
import { NeedError, createNeed } from '@/lib/need-builder/service'
import { needMessageSchema, parseBody } from '@/lib/schemas'
import { NEED_ROLES, TURNS_PER_HOUR, needErrorResponse } from './shared'

// Цепочка моделей с таймаутом на каждую; на Vercel без этого функцию оборвёт раньше
export const maxDuration = 60

/** Новая потребность с первым сообщением компании. */
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, NEED_ROLES)
    if (response) return response

    const parsed = parseBody(needMessageSchema, await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

    if (!rateLimit(`need:turn:${user.id}`, TURNS_PER_HOUR, 60 * 60 * 1000).ok) {
      return NextResponse.json({ error: 'Слишком много сообщений за час. Попробуйте позже.' }, { status: 429 })
    }

    try {
      const result = await createNeed(user.id, parsed.data.text, request.cookies.get('lang')?.value === 'kz' ? 'kz' : 'ru')
      return NextResponse.json(result, { status: 201 })
    } catch (error) {
      if (error instanceof NeedError) refundRateLimit(`need:turn:${user.id}`)
      throw error
    }
  } catch (error) {
    return needErrorResponse(error, 'Не удалось начать подбор')
  }
}
