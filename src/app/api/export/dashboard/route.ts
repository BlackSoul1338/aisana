import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { formatDate, formatDateTime } from '@/lib/datetime'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { translations } from '@/lib/i18n'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { INDUSTRIES, industryLabel } from '@/lib/industries'
import { isDescriptionEmpty } from '@/lib/project-completeness'

export const dynamic = 'force-dynamic'

// Русские подписи статусов/категорий из общего словаря переводов
function label(section: 'projects', key: string): string {
  const sec = translations[section] as Record<string, { ru: string }>
  return sec?.[key]?.ru ?? key
}

export async function GET(request: NextRequest) {
  try {
    // Генерация файла — недешёвая операция, ограничиваем: 5 выгрузок в минуту с IP
    const ip = getClientIp(request)
    if (!rateLimit(`export:${ip}`, 5, 60 * 1000).ok) {
      return NextResponse.json({ error: 'Слишком много запросов на экспорт' }, { status: 429 })
    }

    const [projects, regions, technologies] = await Promise.all([
      prisma.project.findMany({
        where: PUBLISHED_ONLY,
        include: {
          university: { select: { name: true, shortName: true, region: { select: { name: true } } } },
          technologies: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.region.findMany({
        include: { universities: { include: { _count: { select: { projects: true } } } } },
        orderBy: { name: 'asc' },
      }),
      prisma.technology.findMany({
        include: { _count: { select: { projects: true } } },
        orderBy: { projects: { _count: 'desc' } },
      }),
    ])

    const implemented = projects.filter(p => p.status === 'IMPLEMENTED' || p.status === 'SCALED')

    // ── Лист «Сводка» ──────────────────────────────────────────
    const summary = [
      { 'Показатель': 'Всего проектов', 'Значение': projects.length },
      { 'Показатель': 'Внедрено и масштабировано', 'Значение': implemented.length },
      { 'Показатель': 'Лучших практик', 'Значение': projects.filter(p => p.isBestPractice).length },
      { 'Показатель': 'К тиражированию', 'Значение': projects.filter(p => p.isScalable).length },
      { 'Показатель': 'Участников команд (сумма по заполненным карточкам)', 'Значение': projects.reduce((s, p) => s + (p.teamSize || 0), 0) },
      { 'Показатель': 'Карточек с указанным размером команды', 'Значение': projects.filter(p => p.teamSize).length },
      { 'Показатель': 'Карточек без описания', 'Значение': projects.filter(p => isDescriptionEmpty(p.description)).length },
      { 'Показатель': 'Вузов с проектами', 'Значение': new Set(projects.map(p => p.universityId)).size },
      { 'Показатель': 'Дата выгрузки', 'Значение': formatDateTime(new Date()) },
    ]

    // ── Лист «Проекты» (реестр) ────────────────────────────────
    const registry = projects.map(p => ({
      'Название': p.title,
      'Вуз': p.university.shortName || p.university.name,
      'Регион': p.university.region.name,
      'Категория': label('projects', p.category),
      'Статус': label('projects', p.status),
      'Отрасль': industryLabel(p.industry),
      'Где внедрено': p.implementedAt || '',
      'Технологии': p.technologies.map(t => t.name).join(', '),
      'Руководитель': p.leadName || '',
      'Команда, чел.': p.teamSize ?? '',
      'Дата запуска': p.launchDate ? formatDate(p.launchDate) : '',
      'Лучшая практика': p.isBestPractice ? 'Да' : '',
      'К тиражированию': p.isScalable ? 'Да' : '',
      'Просмотров': p.viewCount,
      'Попаданий в ИИ-поиск': p.searchHitCount,
    }))

    // ── Лист «Стадии» ──────────────────────────────────────────
    const STAGES = ['IDEA', 'PROTOTYPE', 'PILOT', 'IMPLEMENTED', 'SCALED'] as const
    const byStage = STAGES.map(status => {
      const rows = projects.filter(p => p.status === status)
      return {
        'Стадия': label('projects', status),
        'Проектов': rows.length,
        'Доля, %': projects.length ? Math.round((rows.length / projects.length) * 100) : 0,
        'Указано, где внедрено': rows.filter(p => p.implementedAt?.trim()).length,
        'Без описания': rows.filter(p => isDescriptionEmpty(p.description)).length,
      }
    })

    // ── Лист «Отрасли» ─────────────────────────────────────────
    const byIndustry = [
      ...INDUSTRIES.map(i => ({ 'Отрасль': i.ru, 'Проектов': projects.filter(p => p.industry === i.value).length })),
      { 'Отрасль': 'Не указана', 'Проектов': projects.filter(p => !p.industry).length },
    ]

    // ── Лист «Регионы» ─────────────────────────────────────────
    const byRegion = regions.map(r => ({
      'Регион': r.name,
      'Вузов': r.universities.length,
      'Проектов': r.universities.reduce((s, u) => s + u._count.projects, 0),
    }))

    // ── Лист «Технологии» ──────────────────────────────────────
    const byTech = technologies
      .filter(t => t._count.projects > 0)
      .map(t => ({ 'Технология': t.name, 'Проектов': t._count.projects }))

    const wb = XLSX.utils.book_new()
    const addSheet = (rows: object[], name: string, widths: number[]) => {
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = widths.map(wch => ({ wch }))
      XLSX.utils.book_append_sheet(wb, ws, name)
    }
    addSheet(summary, 'Сводка', [34, 20])
    addSheet(registry, 'Проекты', [40, 22, 24, 18, 14, 28, 30, 30, 22, 12, 14, 14, 14, 12, 18])
    addSheet(byStage, 'Стадии', [20, 12, 10, 24, 14])
    addSheet(byIndustry, 'Отрасли', [42, 12])
    addSheet(byRegion, 'Регионы', [30, 10, 12])
    addSheet(byTech, 'Технологии', [30, 12])

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ai_map_kz_report_${date}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Dashboard export error:', error)
    return NextResponse.json({ error: 'Ошибка формирования отчёта' }, { status: 500 })
  }
}
