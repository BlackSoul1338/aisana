import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { visibleProjectsWhere } from '@/lib/publication'
import { audit } from '@/lib/audit'
import { parseBody, hearingSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(hearingSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data

    // Внешние id и дата раньше уходили в Prisma как есть: опечатка в id или
    // неразбираемая дата давали 500 вместо 400.
    const date = new Date(data.date)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
    }
    const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } })
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 400 })
    }

    const hearing = await prisma.hearing.create({
      data: {
        projectId: data.projectId,
        date,
        commission: data.commission || [],
        remarks: data.remarks || null,
        recommendations: data.recommendations || null,
        decision: data.decision || 'PENDING',
        decisionText: data.decisionText || null,
      },
    })

    await audit(user, 'CREATE', 'hearing', hearing.id)
    return NextResponse.json(hearing, { status: 201 })
  } catch (error: any) {
    console.error('Create hearing error:', error)
    return NextResponse.json({ error: 'Ошибка создания' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { user, response } = await requireApiUser(request)
    if (response) return response

    // Заслушивания — внутренняя работа комиссии: партнёру они закрыты и в API,
    // а не только на страницах
    if (user.role === UserRole.BUSINESS) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Слушания черновиков посторонним не показываем: модераторы видят всё,
    // представитель вуза — проекты своего вуза, остальные — только опубликованные
    const hearings = await prisma.hearing.findMany({
      where: { project: visibleProjectsWhere(user) },
      include: { project: { include: { university: true } } },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(hearings)
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
