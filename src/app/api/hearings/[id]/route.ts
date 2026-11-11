import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { canViewProjectContent } from '@/lib/publication'
import { audit } from '@/lib/audit'
import { parseBody, hearingSchema } from '@/lib/schemas'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { user, response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params
    const hearing = await prisma.hearing.findUnique({
      where: { id },
      include: { project: { include: { university: true } } },
    })
    if (!hearing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    // Слушание черновика не должно читаться в обход видимости проекта
    if (!canViewProjectContent(user, hearing.project)) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    }
    return NextResponse.json(hearing)
  } catch {
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(hearingSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data
    const hearing = await prisma.hearing.update({
      where: { id },
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
    await audit(user, 'UPDATE', 'hearing', hearing.id)
    return NextResponse.json(hearing)
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const { id } = await params
    await prisma.hearing.delete({ where: { id } })
    await audit(user, 'DELETE', 'hearing', id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
