import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, requireApiRole, requireApiUser } from '@/lib/auth'
import { canViewProjectContent } from '@/lib/publication'
import { deleteUpload } from '@/lib/uploads'
import { isAllowedFileUrl } from '@/lib/file-url'
import { audit } from '@/lib/audit'
import { parseBody, passportSchema } from '@/lib/schemas'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  const { user, response } = await requireApiUser(request)
  if (response) return response

  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: { agentPassportPdf: true, universityId: true, publication: true },
  })
  // Паспорт черновика не должен утекать: сам проект скрыт от посторонних,
  // но паспорт читался отдельным эндпоинтом
  if (!project || !canViewProjectContent(user, project)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ url: project.agentPassportPdf })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { universityId: true, agentPassportPdf: true },
    })
    if (!existing) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    if (!canAccessUniversity(user, existing.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(passportSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { url } = parsed.data

    // Basic sanity check on the URL to avoid storing garbage / javascript: links
    if (url && !isAllowedFileUrl(url)) {
      return NextResponse.json(
        { error: 'Ссылка должна начинаться с http(s):// или быть загруженным файлом (/uploads/)' },
        { status: 400 }
      )
    }

    const project = await prisma.project.update({
      where: { id },
      data: { agentPassportPdf: url || null },
      select: { id: true, agentPassportPdf: true },
    })

    // Старый локальный PDF больше не нужен — удаляем с диска, чтобы
    // volume с загрузками не рос бесконечно при каждой замене.
    // Если тот же файл привязан к другому проекту, он останется на диске.
    if (existing.agentPassportPdf && existing.agentPassportPdf !== (url || null)) {
      await deleteUpload(existing.agentPassportPdf)
    }

    await audit(user, 'UPDATE', 'passport', id, url ? 'установлен' : 'очищен')
    revalidatePath(`/projects/${id}`)
    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Update passport error:', error)
    return NextResponse.json({ error: 'Ошибка сохранения паспорта' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { universityId: true, agentPassportPdf: true },
    })
    if (!existing) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    if (!canAccessUniversity(user, existing.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    await prisma.project.update({
      where: { id },
      data: { agentPassportPdf: null },
    })

    // Чистим файл с диска, чтобы не копить сироты в volume загрузок
    await deleteUpload(existing.agentPassportPdf)

    await audit(user, 'DELETE', 'passport', id)
    revalidatePath(`/projects/${id}`)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Delete passport error:', error)
    return NextResponse.json({ error: 'Ошибка удаления паспорта' }, { status: 500 })
  }
}
