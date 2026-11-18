import { NextRequest, NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/auth'
import { rateLimit, refundRateLimit } from '@/lib/rate-limit'
import { NeedError, takeTurn } from '@/lib/need-builder/service'
import { needMessageSchema, parseBody } from '@/lib/schemas'
import { NEED_ROLES, TURNS_PER_HOUR, needErrorResponse } from '../../shared'

export const maxDuration = 60

/** Ответ компании на вопросы помощника. Потребность видит только автор. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, NEED_ROLES)
    if (response) return response

    const parsed = parseBody(needMessageSchema, await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

    if (!rateLimit(`need:turn:${user.id}`, TURNS_PER_HOUR, 60 * 60 * 1000).ok) {
      return NextResponse.json({ error: 'Слишком много сообщений за час. Попробуйте позже.' }, { status: 429 })
    }

    const { id } = await params
    try {
      const lang = request.cookies.get('lang')?.value === 'kz' ? 'kz' : 'ru'
      return NextResponse.json(await takeTurn(id, user.id, parsed.data.text, lang))
    } catch (error) {
      if (error instanceof NeedError) refundRateLimit(`need:turn:${user.id}`)
      throw error
    }
  } catch (error) {
    return needErrorResponse(error, 'Не удалось обработать сообщение')
  }
}
