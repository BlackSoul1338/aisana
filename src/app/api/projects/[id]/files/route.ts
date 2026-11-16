import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { canAccessUniversity, requireApiRole, requireApiUser } from '@/lib/auth'
import { canViewProjectContent } from '@/lib/publication'
import { deleteUpload } from '@/lib/uploads'
import { isAllowedFileUrl } from '@/lib/file-url'
import { audit } from '@/lib/audit'
import { UserRole } from '@prisma/client'
import { deleteFileSchema, parseBody, projectFileSchema } from '@/lib/schemas'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Настоящая проверка сессии: middleware смотрит только наличие cookie
  const { user, response } = await requireApiUser(request)
  if (response) return response

  const { id } = await params
  // Файлы черновика не должны утекать: сам проект скрыт от посторонних,
  // но файлы читались отдельным эндпоинтом
  const project = await prisma.project.findUnique({
    where: { id },
    select: { universityId: true, publication: true },
  })
  if (!project || !canViewProjectContent(user, project)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  const files = await prisma.projectFile.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(files)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id }, select: { universityId: true } })
    if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    if (!canAccessUniversity(user, project.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(projectFileSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data

    // Та же проверка, что и у паспорта проекта: url рендерится как <a href>
    // на публичной странице, поэтому javascript:-ссылки и прочий мусор
    // не должны попадать в базу.
    if (!isAllowedFileUrl(data.url)) {
      return NextResponse.json(
        { error: 'Ссылка должна начинаться с http(s):// или быть загруженным файлом (/uploads/)' },
        { status: 400 }
      )
    }

    const file = await prisma.projectFile.create({
      data: {
        projectId: id,
        type: data.type,
        label: data.label,
        url: data.url,
        size: data.size || null,
      },
    })
    await audit(user, 'CREATE', 'project_file', file.id, `${data.label} → проект ${id}`)

    // Сбрасываем ISR-кэш публичной страницы — изменения видны сразу,
    // а не через 60 секунд
    revalidatePath(`/projects/${id}`)

    return NextResponse.json(file, { status: 201 })
  } catch (error: any) {
    console.error('Add project file error:', error)
    return NextResponse.json({ error: 'Ошибка добавления файла' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const { id } = await params
    const project = await prisma.project.findUnique({ where: { id }, select: { universityId: true } })
    if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    if (!canAccessUniversity(user, project.universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого проекта' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(deleteFileSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { fileId } = parsed.data

    // Ensure the file actually belongs to this project (defense in depth)
    const file = await prisma.projectFile.findUnique({ where: { id: fileId } })
    if (!file || file.projectId !== id) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
    }

    await prisma.projectFile.delete({ where: { id: fileId } })

    // Если файл был загружен локально (/uploads/...) — удаляем и с диска.
    // Если тот же файл привязан к другому проекту, он останется на диске.
    await deleteUpload(file.url)

    await audit(user, 'DELETE', 'project_file', fileId, file.label)

    revalidatePath(`/projects/${id}`)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Delete project file error:', error)
    return NextResponse.json({ error: 'Ошибка удаления файла' }, { status: 500 })
  }
}
