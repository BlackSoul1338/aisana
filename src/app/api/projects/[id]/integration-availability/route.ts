import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { parseBody, integrationAvailabilitySchema } from '@/lib/schemas'

/**
 * Витрина решений для бизнеса. Флаг публичный, поэтому ставить его может
 * только модератор — отдельным действием с понятной записью в аудите.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const parsed = parseBody(integrationAvailabilitySchema, await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const { id } = await params
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { availableForIntegration: true },
    })
    if (!existing) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

    const next = parsed.data.availableForIntegration
    if (existing.availableForIntegration === next) {
      return NextResponse.json({ id, availableForIntegration: next })
    }

    await prisma.project.update({
      where: { id },
      data: { availableForIntegration: next },
    })
    await audit(user, 'UPDATE', 'project', id,
      `доступность для интеграции: ${existing.availableForIntegration} → ${next}`)
    revalidatePath('/business/solutions')
    revalidatePath(`/projects/${id}`)
    return NextResponse.json({ id, availableForIntegration: next })
  } catch (error) {
    console.error('Integration availability error:', error)
    return NextResponse.json({ error: 'Не удалось изменить доступность' }, { status: 500 })
  }
}
