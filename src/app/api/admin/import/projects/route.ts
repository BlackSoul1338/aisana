import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { parseProjectWorkbook, importProjectsFromRows } from '@/lib/project-import'
import { requireApiRole } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { invalidateSearchIndex, reindexAllProjects } from '@/lib/search/store'
import { checkImportRows, checkImportSize } from '@/lib/import-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

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

    // Проверяем размер ДО чтения в память: arrayBuffer() съедает весь файл
    const sizeError = checkImportSize(file.size)
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rows = parseProjectWorkbook(buffer)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'В файле нет строк для импорта' }, { status: 400 })
    }

    // Большой импорт упирается в память и транзакции БД
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
