import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { requireApiRole } from '@/lib/auth'
import { invalidateSearchIndex } from '@/lib/search/store'
import { parseBody, publicationSchema } from '@/lib/schemas'
import { changePublication } from '@/lib/publication-change'

/**
 * Смена статуса публикации проекта. Правила — в lib/publication-change.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiRole(request, [
      UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP,
    ])
    if (response) return response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(publicationSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const result = await changePublication(user, id, parsed.data.publication, parsed.data.note)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Состав поискового индекса зависит от публикации — сбрасываем кэш
    invalidateSearchIndex()
    // Сбрасываем кэш публичных страниц, чтобы изменение было видно сразу
    revalidatePath('/projects')
    revalidatePath('/')

    return NextResponse.json(result.project)
  } catch (error) {
    console.error('Publication change error:', error)
    return NextResponse.json({ error: 'Ошибка смены статуса' }, { status: 500 })
  }
}
