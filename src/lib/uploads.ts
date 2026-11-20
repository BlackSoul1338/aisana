import { del } from '@vercel/blob'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canViewProjectContent } from '@/lib/publication'
import { uploadFilename } from '@/lib/file-url'

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
 * Можно ли привязать ссылку на загрузку к проекту пользователя.
 *
 * Файл, уже привязанный к чужому черновику, привязывать нельзя: иначе
 * представитель вуза подставлял бы чужой /uploads/... в свой проект и
 * открывал его через проверку владельца в /uploads/[filename].
 * Свежая загрузка ссылок ещё не имеет — её разрешаем, а имя файла содержит
 * криптографический случайный суффикс, поэтому угадать его нельзя.
 */
export async function canAttachUpload(
  user: { role: UserRole; universityId?: string | null },
  url: string,
): Promise<boolean> {
  const filename = uploadFilename(url)
  if (!filename) return true

  const suffix = `/uploads/${filename}`
  const [asFiles, asPassports] = await Promise.all([
    prisma.projectFile.findMany({
      where: { url: { endsWith: suffix } },
      select: { project: { select: { universityId: true, publication: true } } },
    }),
    prisma.project.findMany({
      where: { agentPassportPdf: { endsWith: suffix } },
      select: { universityId: true, publication: true },
    }),
  ])
  const owners = [...asFiles.map(file => file.project), ...asPassports]

  // Ни одной привязки — это только что загруженный файл.
  if (owners.length === 0) return true
  return owners.some(owner => canViewProjectContent(user, owner))
}

/**
 * Удаляет ранее загруженный файл из Blob-хранилища.
 *
 * Реагирует только на наши собственные ссылки вида /uploads/xxx.pdf.
 * Внешние (Google Диск и прочее) не трогает: ими мы не владеем.
 *
 * Файл может быть привязан к нескольким проектам (в project_files нет
 * уникальности на url), а внутри проекта — и к паспорту, и к вкладке
 * «Файлы и ссылки». Поэтому перед удалением проверяем, не осталось ли на
 * него ссылок: иначе удаление в одном месте ломает ссылку в остальных.
 * Вызывать после того, как удаляемая ссылка уже убрана из базы.
 *
 * Ошибки не выбрасывает: отсутствие файла не должно ломать API-ответ.
 * Записи, оставшиеся от версии, которая писала файлы на диск, в хранилище
 * не найдутся — это ожидаемо и просто попадёт в лог.
 */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  // uploadFilename понимает и относительный /uploads/имя.pdf, и полный адрес
  // портала; внешние ссылки (Google Диск и прочее) не трогает.
  const filename = uploadFilename(url)
  if (!filename) return

  // На файл ещё есть ссылка — не удаляем. Проверяем и вкладку
  // «Файлы и ссылки», и паспорт проекта: ссылка может жить в обоих.
  // Сравниваем по окончанию: часть ссылок записана полным адресом портала
  // (https://…/uploads/имя.pdf), а не относительным.
  const suffix = `/uploads/${filename}`
  try {
    const [asFile, asPassport] = await Promise.all([
      prisma.projectFile.count({ where: { url: { endsWith: suffix } } }),
      prisma.project.count({ where: { agentPassportPdf: { endsWith: suffix } } }),
    ])
    if (asFile > 0 || asPassport > 0) return
  } catch (error) {
    // Не смогли проверить — лучше не удалять, чтобы не оставить битую ссылку
    console.error(`Failed to check upload usage for ${filename}`, error)
    return
  }

  try {
    await del(`${BLOB_PREFIX}/${filename}`, { storeId: BLOB_STORE_ID })
  } catch (error) {
    console.error(`Failed to delete upload ${filename}:`, error)
  }
}
