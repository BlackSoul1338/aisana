import { del, get, put } from '@vercel/blob'
import path from 'path'
import fs from 'fs/promises'

/**
 * Идентификатор Blob-хранилища. Vercel подставляет переменную сам, когда store
 * подключён к проекту; вместе с VERCEL_OIDC_TOKEN этого достаточно для доступа,
 * отдельный BLOB_READ_WRITE_TOKEN заводить не нужно.
 */
export const BLOB_STORE_ID = process.env.BLOB_READ_WRITE_TOKEN_STORE_ID

/**
 * Предел размера загружаемого PDF.
 *
 * Ограничение не наше: тело запроса к serverless-функции на Vercel не может
 * быть больше 4.5 МБ, дальше платформа отвечает 413 ещё до нашего кода.
 * Берём с запасом. Чтобы принимать файлы крупнее, заливать нужно прямо
 * в Blob с клиента (@vercel/blob/client), минуя функцию.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

/** Каталог внутри Blob-хранилища, куда складываются загруженные PDF. */
export const BLOB_PREFIX = 'uploads'

/**
 * Каталог для локального хранения PDF, когда Vercel Blob недоступен.
 *
 * Держим файлы ВНЕ public/: каталог public отдаётся статикой Next.js
 * без проверки сессии, а паспорта и документы проектов приватные.
 * По умолчанию — ./uploads_data рядом с приложением, в Docker это том.
 */
export const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || path.join(process.cwd(), 'uploads_data')

/**
 * Хранилище включено, если задан токен Blob.
 *
 * Локальная разработка и стенд без Vercel работают на диске: так не нужен
 * настоящий BLOB_READ_WRITE_TOKEN и поднимается одним compose.
 */
export const BLOB_ENABLED = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

/** Имя файла в хранилище — без пути, только базовое имя. */
function safeName(filename: string): string {
  return path.basename(filename)
}

/**
 * Сохраняет PDF. В Blob или на диск — в зависимости от наличия токена.
 * Возвращает публичный адрес файла (/uploads/имя.pdf).
 */
export async function saveUpload(filename: string, buffer: Buffer): Promise<string> {
  const name = safeName(filename)

  if (BLOB_ENABLED) {
    await put(`${BLOB_PREFIX}/${name}`, buffer, {
      access: 'private',
      contentType: 'application/pdf',
      addRandomSuffix: false,
      storeId: BLOB_STORE_ID,
    })
    return `/uploads/${name}`
  }

  await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true })
  await fs.writeFile(path.join(LOCAL_UPLOADS_DIR, name), buffer)
  return `/uploads/${name}`
}

/**
 * Читает PDF для отдачи клиенту.
 * Возвращает null, если файла нет.
 */
export async function readUpload(
  filename: string
): Promise<{ body: ReadableStream | Buffer; contentType: string; size: number } | null> {
  const name = safeName(filename)
  if (!name.toLowerCase().endsWith('.pdf')) return null

  if (BLOB_ENABLED) {
    const result = await get(`${BLOB_PREFIX}/${name}`, {
      access: 'private',
      storeId: BLOB_STORE_ID,
    })
    if (!result || result.statusCode !== 200) return null
    return {
      body: result.stream,
      contentType: result.blob.contentType || 'application/pdf',
      size: result.blob.size,
    }
  }

  try {
    const filePath = path.join(LOCAL_UPLOADS_DIR, name)
    const data = await fs.readFile(filePath)
    return { body: data, contentType: 'application/pdf', size: data.length }
  } catch {
    return null
  }
}

/**
 * Удаляет ранее загруженный файл (из Blob или с диска).
 *
 * Реагирует только на наши собственные ссылки вида /uploads/xxx.pdf.
 * Внешние (Google Диск и прочее) не трогает: ими мы не владеем.
 *
 * Ошибки не выбрасывает: отсутствие файла не должно ломать API-ответ.
 * Записи, оставшиеся от версии, которая писала файлы на диск, в хранилище
 * не найдутся — это ожидаемо и просто попадёт в лог.
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return

  // path.basename защищает от path traversal (../../etc/passwd не пройдёт).
  const filename = path.basename(url)
  if (!filename) return

  try {
    if (BLOB_ENABLED) {
      await del(`${BLOB_PREFIX}/${filename}`, { storeId: BLOB_STORE_ID })
    } else {
      await fs.unlink(path.join(LOCAL_UPLOADS_DIR, filename))
    }
  } catch (error) {
    console.error(`Failed to delete upload ${filename}:`, error)
  }
}
