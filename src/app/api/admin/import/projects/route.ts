import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseProjectWorkbook, importProjectsFromRows } from '@/lib/project-import'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { invalidateSearchIndex, reindexAllProjects } from '@/lib/search/store'
import { IMPORT_SHEET_ROWS, checkImportRequestSize, checkImportRows, checkImportSize } from '@/lib/import-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    // Объявленный размер — до formData(): тот читает тело в память целиком
    const bodyError = checkImportRequestSize(request.headers.get('content-length'))
    if (bodyError) {
      return NextResponse.json({ error: bodyError }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const dryRun = formData.get('dryRun') !== 'false'

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Загрузите Excel или CSV файл' }, { status: 400 })
    }

    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      return NextResponse.json({ error: 'Поддерживаются .xlsx, .xls и .csv' }, { status: 400 })
    }

    // Точный размер файла — до разбора: книга раздувается в памяти во много раз
    const sizeError = checkImportSize(file.size)
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parseProjectWorkbook(buffer, IMPORT_SHEET_ROWS)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'В файле нет строк для импорта' }, { status: 400 })
    }

    // Строки пишутся в базу по одной: большой импорт держал бы запрос минутами
    const rowsError = checkImportRows(rows.length)
    if (rowsError) {
      return NextResponse.json({ error: rowsError }, { status: 400 })
    }

    const result = await importProjectsFromRows(prisma, rows, user, dryRun)
    if (!dryRun) {
      // После массового импорта пересчитываем направления и сбрасываем индекс
      await reindexAllProjects(prisma).catch(err =>
        console.error('Переиндексация после импорта не удалась', err))
      invalidateSearchIndex()
      await audit(user, 'IMPORT', 'projects', null, `строк: ${rows.length}`)
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Project import error:', error)
    return NextResponse.json({ error: 'Ошибка импорта проектов' }, { status: 500 })
  }
}
