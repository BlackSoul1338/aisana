import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isFirstInWindow, rateLimit } from '@/lib/rate-limit'
import { requireApiUser } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params

    // Общий предохранитель: не более 60 запросов к счётчику с одного пользователя в минуту
    if (!rateLimit(`view:rl:${user.id}`, 60, 60 * 1000).ok) {
      return NextResponse.json({ ok: false })
    }

    // Серверная дедупликация: один пользователь засчитывается для проекта
    // не чаще одного раза в час (sessionStorage на клиенте — лишь UX-слой,
    // накрутка через curl теперь не работает).
    if (!isFirstInWindow(`view:${user.id}:${id}`, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: true, counted: false })
    }

    await prisma.project.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })
    return NextResponse.json({ ok: true, counted: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
