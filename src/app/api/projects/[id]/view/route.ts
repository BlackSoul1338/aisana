import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isFirstInWindow, rateLimit } from '@/lib/rate-limit'
import { requireApiUser } from '@/lib/auth'
import { canViewProjectContent } from '@/lib/publication'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params

    // Общий предохранитель: не более 60 запросов к счётчику с одного пользователя в минуту
    if (!rateLimit(`view:rl:${user.id}`, 60, 60 * 1000).ok) {
      return NextResponse.json({ ok: false })
    }

    // Счётчик — часть карточки: чужой черновик по id не должен ни открываться,
    // ни накручивать статистику.
    const project = await prisma.project.findUnique({
      where: { id },
      select: { universityId: true, publication: true },
    })
    if (!project || !canViewProjectContent(user, project)) {
      return NextResponse.json({ ok: false }, { status: 404 })
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
