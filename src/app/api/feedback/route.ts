import { NextRequest, NextResponse } from 'next/server'
import { FeedbackStatus, FeedbackTopic, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { feedbackSchema, feedbackStatusSchema, parseBody } from '@/lib/schemas'

/** Приём обращения с публичной страницы «Контакты». */
export async function POST(request: NextRequest) {
  try {
    // Общий предохранитель от флуда: считает все попытки, включая неудачные
    const ip = getClientIp(request)
    if (!rateLimit(`feedback:flood:${ip}`, 30, 10 * 60 * 1000).ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов. Попробуйте позже или напишите на почту.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(feedbackSchema, body)

    // Honeypot: поле скрыто от людей, боты его заполняют.
    // Отвечаем успехом, чтобы бот не подбирал обход.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true })
    }

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data

    const name = data.name
    const email = data.email.toLowerCase()
    const message = data.message
    const organization = data.organization
    const topic = data.topic ?? FeedbackTopic.QUESTION

    // Лимит на сохранённые обращения считаем только после проверки формы,
    // чтобы опечатки в почте не съедали квоту добросовестного пользователя.
    const short = rateLimit(`feedback:sent:${ip}`, 3, 10 * 60 * 1000)
    const long = rateLimit(`feedback:day:${ip}`, 10, 24 * 60 * 60 * 1000)
    if (!short.ok || !long.ok) {
      return NextResponse.json(
        { error: 'Слишком много обращений. Попробуйте позже или напишите на почту.' },
        { status: 429 }
      )
    }

    await prisma.feedback.create({
      data: { topic, name, email, organization, message },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Feedback create error:', error)
    return NextResponse.json({ error: 'Не удалось отправить обращение' }, { status: 500 })
  }
}

/** Смена статуса обращения — только для администраторов и редакторов. */
export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(feedbackStatusSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { id, status } = parsed.data

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        status,
        handledAt: status === FeedbackStatus.DONE ? new Date() : null,
      },
      select: { id: true, status: true },
    })

    await audit(user, 'UPDATE', 'feedback', feedback.id, `статус: ${status}`)
    return NextResponse.json(feedback)
  } catch (error) {
    console.error('Feedback update error:', error)
    return NextResponse.json({ error: 'Не удалось обновить обращение' }, { status: 500 })
  }
}
