import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole, requireApiUser } from '@/lib/auth'
import { deleteUpload } from '@/lib/uploads'
import { invalidateSearchIndex } from '@/lib/search/store'
import { PUBLISHED_PROJECTS_RELATION } from '@/lib/publication'
import { audit } from '@/lib/audit'
import { parseBody, universityUpdateSchema } from '@/lib/schemas'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { user, response } = await requireApiUser(request)
    if (response) return response

    const { id } = await params
    const moderator = user.role === UserRole.ADMIN || user.role === UserRole.EDITOR

    const university = await prisma.university.findUnique({
      where: { id },
      include: {
        region: true,
        // Черновики видны только модераторам и представителю своего вуза
        projects: {
          include: { technologies: true },
          where: moderator ? undefined : PUBLISHED_PROJECTS_RELATION.where,
        },
      },
    })
    if (!university) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    return NextResponse.json(university)
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
    const parsed = parseBody(universityUpdateSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data

    // Пишем только те поля, что реально пришли в теле. Раньше все поля
    // писались через «|| null», и запрос без nameKz обнулял его в базе —
    // молчаливая потеря данных.
    const update: Record<string, unknown> = {}
    if (data.name !== undefined) update.name = data.name
    if (data.nameKz !== undefined) update.nameKz = data.nameKz
    if (data.shortName !== undefined) update.shortName = data.shortName
    if (data.regionId !== undefined) update.regionId = data.regionId
    if (data.address !== undefined) update.address = data.address
    if (data.website !== undefined) update.website = data.website
    if (data.email !== undefined) update.email = data.email
    if (data.phone !== undefined) update.phone = data.phone
    if (data.rector !== undefined) update.rector = data.rector
    if (data.description !== undefined) update.description = data.description
    if (data.type !== undefined) update.type = data.type

    const university = await prisma.university.update({
      where: { id },
      data: update,
    })
    // Название, краткое имя и регион вуза индексируются поиском —
    // без сброса кэша переименование видно только через минуту
    invalidateSearchIndex()

    await audit(user, 'UPDATE', 'university', university.id, university.name)
    return NextResponse.json(university)
  } catch (error: any) {
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN])
    if (response) return response

    const { id } = await params

    // Собираем локальные файлы проектов вуза ДО удаления, чтобы почистить диск
    const projects = await prisma.project.findMany({
      where: { universityId: id },
      select: { id: true, agentPassportPdf: true, files: { select: { url: true } } },
    })

    await prisma.project.deleteMany({ where: { universityId: id } })
    await prisma.university.delete({ where: { id } })

    for (const p of projects) {
      await deleteUpload(p.agentPassportPdf, { exceptProjectId: p.id })
      for (const f of p.files) await deleteUpload(f.url, { exceptProjectId: p.id })
    }

    // Проекты вуза исчезли из выдачи — индекс поиска надо пересобрать
    invalidateSearchIndex()

    await audit(user, 'DELETE', 'university', id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}
