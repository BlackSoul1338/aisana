import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiUser } from '@/lib/auth'
import { readUpload } from '@/lib/uploads'

export const dynamic = 'force-dynamic'

/**
 * Отдаёт загруженный PDF (из Vercel Blob или с диска — локальный стенд).
 *
 * Файлы лежат приватно, публичной ссылки у них нет — поэтому страница проекта
 * запрашивает их здесь, а мы проверяем сессию и стримим содержимое дальше.
 * Адрес намеренно сохранён в прежнем виде (/uploads/имя-файла.pdf): именно
 * так ссылки записаны в базе и такой формат уже проходит валидацию.
 *
 * Права проверяются по проекту-владельцу файла: представитель вуза не должен
 * открыть паспорт проекта чужого вуза, даже зная имя файла.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { user, response } = await requireApiUser(request)
  if (response) return response
  if (!user) return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 })

  const { filename } = await params

  // path.basename отсекает попытки выйти за пределы каталога (../../secret).
  const safeName = path.basename(filename)
  if (!safeName || !safeName.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }

  const url = `/uploads/${safeName}`

  // Кто владеет файлом: проект, в котором он записан как файл или паспорт
  const [asFile, asPassport] = await Promise.all([
    prisma.projectFile.findFirst({
      where: { url },
      select: { project: { select: { universityId: true, publication: true } } },
    }),
    prisma.project.findFirst({
      where: { agentPassportPdf: url },
      select: { universityId: true, publication: true },
    }),
  ])
  const owner = asFile?.project ?? asPassport

  // Файл, к которому не привязан ни один проект, не отдаём никому
  if (!owner) return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })

  const isModerator = user.role === UserRole.ADMIN || user.role === UserRole.EDITOR
  const isOwnerUniversity = user.role === UserRole.UNIVERSITY_REP && user.universityId === owner.universityId
  const isPublishedViewer = user.role === UserRole.VIEWER && owner.publication === 'PUBLISHED'

  if (!isModerator && !isOwnerUniversity && !isPublishedViewer) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  try {
    const file = await readUpload(safeName)
    if (!file) return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })

    return new NextResponse(file.body as ReadableStream, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.size),
        // inline — чтобы документ открывался во фрейме, а не скачивался
        'Content-Disposition': `inline; filename="${safeName}"`,
        // приватный файл не должен оседать в общих кэшах
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error(`Failed to serve upload ${safeName}:`, error)
    return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
  }
}
