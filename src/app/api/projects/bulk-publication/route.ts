import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { UserRole } from '@prisma/client'
import { requireApiRole } from '@/lib/auth'
import { invalidateSearchIndex } from '@/lib/search/store'
import { bulkPublicationSchema, parseBody } from '@/lib/schemas'
import { changePublication } from '@/lib/publication-change'

/**
 * Массовая смена статуса публикации: «опубликовать выбранные»,
 * «вернуть выбранные на доработку».
 *
 * Каждый проект проходит те же проверки, что и при одиночной смене
 * (lib/publication-change). Один отказ не останавливает остальные:
 * в ответе — сколько изменено и какие проекты пропущены с причиной.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [
      UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP,
    ])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(bulkPublicationSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { ids, publication, note } = parsed.data

    const updated: string[] = []
    const skipped: { id: string; title: string; error: string }[] = []
    for (const id of new Set(ids)) {
      const result = await changePublication(user, id, publication, note)
      if (result.ok) updated.push(id)
      else skipped.push({ id, title: result.title || id, error: result.error })
    }

    if (updated.length > 0) {
      invalidateSearchIndex()
      revalidatePath('/projects')
      revalidatePath('/')
    }

    return NextResponse.json({ updated, skipped })
  } catch (error) {
    console.error('Bulk publication change error:', error)
    return NextResponse.json({ error: 'Ошибка смены статуса' }, { status: 500 })
  }
}
