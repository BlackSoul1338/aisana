import type { ProjectStatus } from '@prisma/client'

/**
 * Заполненность карточки проекта.
 *
 * На портале накопились карточки, в которых есть только название: импорт
 * подставлял заглушку «Описание не указано», а форма принимала описание
 * из двух букв. Такие карточки публиковались и попадали в счётчики.
 * Здесь одно правило на всё: что считать пустым описанием и чего не хватает
 * карточке, чтобы её можно было отправить на проверку или опубликовать.
 */

/** Заглушка, которую импорт пишет, когда в таблице нет описания. */
export const DESCRIPTION_PLACEHOLDER = 'Описание не указано'

/** Описание короче — не описание: «Ии», «Test», «Запущен.» */
export const MIN_DESCRIPTION_LENGTH = 20

export function isDescriptionEmpty(description: string | null | undefined): boolean {
  const text = (description ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < MIN_DESCRIPTION_LENGTH) return true
  return text.toLowerCase().startsWith(DESCRIPTION_PLACEHOLDER.toLowerCase())
}

/** Стадии, на которых решение уже где-то работает. */
export function isDeployedStatus(status: ProjectStatus | string | null | undefined): boolean {
  return status === 'IMPLEMENTED' || status === 'SCALED'
}

interface CompletenessInput {
  description?: string | null
  status?: ProjectStatus | string | null
  implementedAt?: string | null
}

/**
 * Почему карточку нельзя отправить на проверку или опубликовать.
 * null — можно.
 *
 * requireImplementedAt: поле «Где внедрено» обязательно для вуза, когда он
 * заявляет стадию «внедрено» или «масштабировано». Модератора оно не
 * блокирует: иначе он не смог бы опубликовать карточки, поданные до
 * появления поля.
 */
export function publicationBlocker(
  project: CompletenessInput,
  options: { requireImplementedAt: boolean },
): string | null {
  if (isDescriptionEmpty(project.description)) {
    return `Заполните описание проекта (не короче ${MIN_DESCRIPTION_LENGTH} символов): карточку без описания нельзя отправить на проверку и опубликовать.`
  }
  if (options.requireImplementedAt && isDeployedStatus(project.status) && !(project.implementedAt ?? '').trim()) {
    return 'Для стадии «Внедрено» или «Масштабировано» укажите, где внедрено решение: организация или подразделение.'
  }
  return null
}
