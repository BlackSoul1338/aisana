import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const data = await request.json()

    if (!data.name || !data.regionId) {
      return NextResponse.json({ error: 'Название и регион обязательны' }, { status: 400 })
    }

    const university = await prisma.university.create({
      data: {
        name: data.name,
        nameKz: data.nameKz || null,
        shortName: data.shortName || null,
        regionId: data.regionId,
        address: data.address || null,
        website: data.website || null,
        email: data.email || null,
        phone: data.phone || null,
        rector: data.rector || null,
        description: data.description || null,
        type: data.type || 'STATE',
      },
    })

    await audit(user, 'CREATE', 'university', university.id, university.name)
    return NextResponse.json(university, { status: 201 })
  } catch (error: any) {
    console.error('Create university error:', error)
    return NextResponse.json({ error: 'Ошибка создания вуза' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { response } = await requireApiUser(request)
    if (response) return response

    const universities = await prisma.university.findMany({
      include: { region: true, _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(universities)
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
