import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params
    const hearing = await prisma.hearing.findUnique({
      where: { id },
      include: { project: { include: { university: true } } },
    })
    if (!hearing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
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
    const data = await request.json()
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
