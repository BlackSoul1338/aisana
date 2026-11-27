import { hasDemo, hasDocuments, SHORT_DESCRIPTION_LENGTH, type ChecklistInput } from '@/lib/card-checklist'
import { isDeployedStatus, isDescriptionEmpty } from '@/lib/project-completeness'

/**
 * «Заполнено N %» в форме карточки: доля выполненных проверок, у всех равный вес.
 *
 * Проверки те же, что у cardChecklist, но документ и демо считаются по
 * отдельности: когда нет обоих, чек-лист выдаёт один пункт «нет подтверждений»,
 * и по числу пунктов процент вышел бы завышенным. «Где внедрено» входит только
 * для стадий «внедрено» и «масштабировано» — как в чек-листе.
 */
export function cardProgress(project: ChecklistInput): number {
  const hasDescription = !isDescriptionEmpty(project.description)
  const descriptionLength = (project.description ?? '').replace(/\s+/g, ' ').trim().length
  const filled = (value: string | null | undefined) => Boolean((value ?? '').trim())

  const checks = [
    hasDescription,
    hasDescription && descriptionLength >= SHORT_DESCRIPTION_LENGTH,
    hasDocuments(project),
    hasDemo(project),
    filled(project.results),
    filled(project.impact),
    filled(project.leadName),
  ]
  if (isDeployedStatus(project.status)) checks.push(filled(project.implementedAt))

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
