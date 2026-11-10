import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
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
