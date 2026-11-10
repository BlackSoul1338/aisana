import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { invalidateSearchIndex } from '@/lib/search/store'
import { parseUniversityWorkbook, importUniversitiesFromRows } from '@/lib/university-import'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') !== 'false'

    if (!file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parseUniversityWorkbook(buffer)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Файл пустой или не читается' }, { status: 400 })
    }

    const summary = await importUniversitiesFromRows(prisma, rows, dryRun)
    if (!dryRun) {
      // Имена вузов индексируются поиском — сбрасываем кэш индекса
      invalidateSearchIndex()
      await audit(user, 'IMPORT', 'universities', null, `строк: ${rows.length}`)
    }
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('University import error:', error)
    return NextResponse.json({ error: 'Ошибка при импорте файла' }, { status: 500 })
  }
}
