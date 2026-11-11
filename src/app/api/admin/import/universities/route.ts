import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { invalidateSearchIndex } from '@/lib/search/store'
import { parseUniversityWorkbook, importUniversitiesFromRows } from '@/lib/university-import'
import { IMPORT_SHEET_ROWS, checkImportRequestSize, checkImportRows, checkImportSize } from '@/lib/import-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (response) return response

    // Объявленный размер — до formData(): тот читает тело в память целиком
    const bodyError = checkImportRequestSize(request.headers.get('content-length'))
    if (bodyError) {
      return NextResponse.json({ error: bodyError }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') !== 'false'

    if (!file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }

    // Точный размер файла — до разбора: книга раздувается в памяти во много раз
    const sizeError = checkImportSize(file.size)
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parseUniversityWorkbook(buffer, IMPORT_SHEET_ROWS)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Файл пустой или не читается' }, { status: 400 })
    }

    // Строки пишутся в базу по одной: большой импорт держал бы запрос минутами
    const rowsError = checkImportRows(rows.length)
    if (rowsError) {
      return NextResponse.json({ error: rowsError }, { status: 400 })
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
