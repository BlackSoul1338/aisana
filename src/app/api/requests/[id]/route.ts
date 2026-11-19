import { NextRequest, NextResponse } from 'next/server'
import { IntegrationRequestStatus, PublicationStatus, UserRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { canModerate } from '@/lib/publication'
import {
  REQUEST_STATUS_LABELS, canChangeStatus, canSetProject, canViewRequest, canWriteUniversityNote,
} from '@/lib/integration-requests'
import { integrationRequestUpdateSchema, parseBody } from '@/lib/schemas'

/**
 * Работа с запросом: оператор ведёт его и передаёт вузу, вуз отвечает
 * и ведёт дальше. Чужой или ещё не переданный запрос — «не найдено».
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [
      UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP,
    ])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(integrationRequestUpdateSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const input = parsed.data

    const { id } = await params
    const existing = await prisma.integrationRequest.findUnique({
      where: { id },
      select: {
        id: true, status: true, userId: true, forwardedAt: true, projectId: true,
        project: { select: { universityId: true } },
      },
    })
    if (!existing || !canViewRequest(user, existing)) {
      return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
    }

    const data: Prisma.IntegrationRequestUpdateInput = {}
    const changes: string[] = []
    // Проверки статуса и ответа идут по запросу с уже новым проектом
    let scope = existing

    if (input.projectId !== undefined && input.projectId !== existing.projectId) {
      if (!canSetProject(user, existing)) {
        return NextResponse.json({ error: 'Проект меняется только до передачи вузу' }, { status: 403 })
      }
      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, title: true, universityId: true, publication: true },
      })
      if (!project || project.publication !== PublicationStatus.PUBLISHED) {
        return NextResponse.json({ error: 'Проект не найден' }, { status: 400 })
      }
      data.project = { connect: { id: project.id } }
      scope = { ...existing, projectId: project.id, project: { universityId: project.universityId } }
      changes.push(`проект: ${project.title}`)
    }

    if (input.status && input.status !== existing.status) {
      if (!canChangeStatus(user, scope, input.status)) {
        return NextResponse.json({ error: 'Такой переход статуса недоступен' }, { status: 403 })
      }
      data.status = input.status
      if (input.status === IntegrationRequestStatus.SENT_TO_UNIVERSITY && !existing.forwardedAt) {
        data.forwardedAt = new Date()
      }
      // Возврат до передачи снимает отметку: иначе вуз продолжает видеть
      // запрос и может писать ответ по запросу, который у него отозвали.
      if (
        (input.status === IntegrationRequestStatus.NEW || input.status === IntegrationRequestStatus.IN_REVIEW) &&
        existing.forwardedAt
      ) {
        data.forwardedAt = null
      }
      changes.push(`статус: ${REQUEST_STATUS_LABELS[input.status]}`)
    }

    if (input.operatorNote !== undefined) {
      if (!canModerate(user)) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
      }
      data.operatorNote = input.operatorNote || null
      changes.push('заметка оператора')
    }

    if (input.universityNote !== undefined) {
      if (!canWriteUniversityNote(user, scope)) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
      }
      data.universityNote = input.universityNote || null
      changes.push('ответ вуза')
    }

    if (changes.length === 0) {
      return NextResponse.json({ error: 'Нет изменений' }, { status: 400 })
    }

    const updated = await prisma.integrationRequest.update({
      where: { id },
      data,
      select: { id: true, status: true },
    })

    await audit(user, 'UPDATE', 'integration_request', id, changes.join('; '))
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Integration request update error:', error)
    return NextResponse.json({ error: 'Не удалось обновить запрос' }, { status: 500 })
  }
}
