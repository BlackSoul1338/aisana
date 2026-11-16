import { NextRequest, NextResponse } from 'next/server'
import { PublicationStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { REQUEST_TYPE_LABELS } from '@/lib/integration-requests'
import { integrationRequestCreateSchema, parseBody } from '@/lib/schemas'

/** Запрос компании по решению из каталога. Попадает в очередь оператора. */
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.BUSINESS_REP])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(integrationRequestCreateSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data

    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, title: true, publication: true },
    })
    if (!project || project.publication !== PublicationStatus.PUBLISHED) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    // Лимит считаем после проверки формы: опечатка не должна съедать квоту
    if (!rateLimit(`requests:sent:${user.id}`, 10, 24 * 60 * 60 * 1000).ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов за сутки. Напишите оператору через «Контакты».' },
        { status: 429 }
      )
    }

    const created = await prisma.integrationRequest.create({
      data: {
        projectId: project.id,
        userId: user.id,
        contactName: user.name,
        contactEmail: user.email,
        organization: user.organization,
        contactPhone: data.contactPhone,
        type: data.type,
        message: data.message,
      },
      select: { id: true, status: true },
    })

    await audit(user, 'CREATE', 'integration_request', created.id,
      `${REQUEST_TYPE_LABELS[data.type]}: ${project.title}`)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Integration request create error:', error)
    return NextResponse.json({ error: 'Не удалось отправить запрос' }, { status: 500 })
  }
}
