import { NextRequest, NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { sendNeed } from '@/lib/need-builder/service'
import { needSendSchema, parseBody } from '@/lib/schemas'
import { NEED_ROLES, needErrorResponse } from '../../shared'

/** Отправка потребности оператору запросом «Консультация». */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, NEED_ROLES)
    if (response) return response

    const parsed = parseBody(needSendSchema, await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

    // Общий счётчик с запросами из карточки проекта
    if (!rateLimit(`requests:sent:${user.id}`, 10, 24 * 60 * 60 * 1000).ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов за сутки. Напишите оператору через «Контакты».' },
        { status: 429 },
      )
    }

    const { id } = await params
    const lang = request.cookies.get('lang')?.value === 'kz' ? 'kz' : 'ru'
    const { requestId, projectTitle } = await sendNeed(id, user, parsed.data, lang)
    await audit(user, 'CREATE', 'integration_request', requestId,
      `Консультация из помощника подбора${projectTitle ? `: ${projectTitle}` : ''}`)
    return NextResponse.json({ id: requestId }, { status: 201 })
  } catch (error) {
    return needErrorResponse(error, 'Не удалось отправить запрос')
  }
}
