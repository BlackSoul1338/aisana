import { NextRequest, NextResponse } from 'next/server'
import { PublicationStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { canModerate } from '@/lib/publication'
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

    const hearing = await prisma.hearing.create({
      data: {
        projectId: data.projectId,
        date: new Date(data.date),
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

    // Слушания черновиков не показываем посторонним: модераторы видят всё,
    // представитель вуза — проекты своего вуза, остальные — только опубликованные
    const hearings = await prisma.hearing.findMany({
      where: canModerate(user)
        ? undefined
        : {
            OR: [
              { project: { publication: PublicationStatus.PUBLISHED } },
              ...(user.universityId
                ? [{ project: { universityId: user.universityId } }]
                : []),
            ],
          },
      include: { project: { include: { university: true } } },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(hearings)
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
