import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireApiUser } from '@/lib/auth'
import { formatDate, formatDateTime } from '@/lib/datetime'
import { PUBLISHED_ONLY } from '@/lib/publication'
import { t } from '@/lib/i18n'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { INDUSTRIES, industryLabel } from '@/lib/industries'
import { technologyLabel } from '@/lib/technologies'
import { isDescriptionEmpty } from '@/lib/project-completeness'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireApiUser(request)
    if (response) return response
    const lang = request.cookies.get('lang')?.value === 'kz' ? 'kz' : 'ru'

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
          technologies: { select: { name: true, slug: true } },
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

    const colIndicator = t('exportXlsx', 'colIndicator', lang)
    const colValue = t('exportXlsx', 'colValue', lang)

    // ── Лист «Сводка» ──────────────────────────────────────────
    const summary = [
      { [colIndicator]: t('exportXlsx', 'sumTotal', lang), [colValue]: projects.length },
      { [colIndicator]: t('exportXlsx', 'sumImplemented', lang), [colValue]: implemented.length },
      { [colIndicator]: t('exportXlsx', 'sumBest', lang), [colValue]: projects.filter(p => p.isBestPractice).length },
      { [colIndicator]: t('exportXlsx', 'sumScalable', lang), [colValue]: projects.filter(p => p.isScalable).length },
      { [colIndicator]: t('exportXlsx', 'sumTeamSum', lang), [colValue]: projects.reduce((s, p) => s + (p.teamSize || 0), 0) },
      { [colIndicator]: t('exportXlsx', 'sumTeamCards', lang), [colValue]: projects.filter(p => p.teamSize).length },
      { [colIndicator]: t('exportXlsx', 'sumNoDesc', lang), [colValue]: projects.filter(p => isDescriptionEmpty(p.description)).length },
      { [colIndicator]: t('exportXlsx', 'sumUniWith', lang), [colValue]: new Set(projects.map(p => p.universityId)).size },
      { [colIndicator]: t('exportXlsx', 'sumExportDate', lang), [colValue]: formatDateTime(new Date()) },
    ]

    const yes = t('exportXlsx', 'yes', lang)
    // ── Лист «Проекты» (реестр) ────────────────────────────────
    const registry = projects.map(p => ({
      [t('exportXlsx', 'colTitle', lang)]: p.title,
      [t('exportXlsx', 'colUniversity', lang)]: p.university.shortName || p.university.name,
      [t('exportXlsx', 'colRegion', lang)]: p.university.region.name,
      [t('exportXlsx', 'colCategory', lang)]: t('category', p.category, lang),
      [t('exportXlsx', 'colStatus', lang)]: t('status', p.status, lang),
      [t('exportXlsx', 'colIndustry', lang)]: industryLabel(p.industry, lang),
      [t('exportXlsx', 'colImplementedWhere', lang)]: p.implementedAt || '',
      [t('exportXlsx', 'colTech', lang)]: p.technologies.map(tech => technologyLabel(tech, lang)).join(', '),
      [t('exportXlsx', 'colLead', lang)]: p.leadName || '',
      [t('exportXlsx', 'colTeam', lang)]: p.teamSize ?? '',
      [t('exportXlsx', 'colLaunch', lang)]: p.launchDate ? formatDate(p.launchDate) : '',
      [t('exportXlsx', 'colBest', lang)]: p.isBestPractice ? yes : '',
      [t('exportXlsx', 'colScalable', lang)]: p.isScalable ? yes : '',
      [t('exportXlsx', 'colViews', lang)]: p.viewCount,
      [t('exportXlsx', 'colAiHits', lang)]: p.searchHitCount,
    }))

    // ── Лист «Стадии» ──────────────────────────────────────────
    const STAGES = ['IDEA', 'PROTOTYPE', 'PILOT', 'IMPLEMENTED', 'SCALED'] as const
    const byStage = STAGES.map(status => {
      const rows = projects.filter(p => p.status === status)
      return {
        [t('exportXlsx', 'colStage', lang)]: t('status', status, lang),
        [t('exportXlsx', 'colProjects', lang)]: rows.length,
        [t('exportXlsx', 'colShare', lang)]: projects.length ? Math.round((rows.length / projects.length) * 100) : 0,
        [t('exportXlsx', 'colWhereSpecified', lang)]: rows.filter(p => p.implementedAt?.trim()).length,
        [t('exportXlsx', 'colNoDesc', lang)]: rows.filter(p => isDescriptionEmpty(p.description)).length,
      }
    })

    // ── Лист «Отрасли» ─────────────────────────────────────────
    const colIndustry = t('exportXlsx', 'colIndustry', lang)
    const colProjects = t('exportXlsx', 'colProjects', lang)
    const byIndustry = [
      ...INDUSTRIES.map(i => ({ [colIndustry]: i[lang], [colProjects]: projects.filter(p => p.industry === i.value).length })),
      { [colIndustry]: t('exportXlsx', 'industryNone', lang), [colProjects]: projects.filter(p => !p.industry).length },
    ]

    // ── Лист «Регионы» ─────────────────────────────────────────
    const byRegion = regions.map(r => ({
      [t('exportXlsx', 'colRegion', lang)]: lang === 'kz' && r.nameKz ? r.nameKz : r.name,
      [t('exportXlsx', 'colUniversities', lang)]: r.universities.length,
      [t('exportXlsx', 'colProjects', lang)]: r.universities.reduce((s, u) => s + u._count.projects, 0),
    }))

    // ── Лист «Технологии» ──────────────────────────────────────
    const byTech = technologies
      .filter(tech => tech._count.projects > 0)
      .map(tech => ({ [t('exportXlsx', 'colTech', lang)]: technologyLabel(tech, lang), [colProjects]: tech._count.projects }))

    const wb = XLSX.utils.book_new()
    const addSheet = (rows: object[], name: string, widths: number[]) => {
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = widths.map(wch => ({ wch }))
      XLSX.utils.book_append_sheet(wb, ws, name)
    }
    addSheet(summary, t('exportXlsx', 'sheetSummary', lang), [34, 20])
    addSheet(registry, t('exportXlsx', 'sheetProjects', lang), [40, 22, 24, 18, 14, 28, 30, 30, 22, 12, 14, 14, 14, 12, 18])
    addSheet(byStage, t('exportXlsx', 'sheetStages', lang), [20, 12, 10, 24, 14])
    addSheet(byIndustry, t('exportXlsx', 'sheetIndustries', lang), [42, 12])
    addSheet(byRegion, t('exportXlsx', 'sheetRegions', lang), [30, 10, 12])
    addSheet(byTech, t('exportXlsx', 'sheetTech', lang), [30, 12])

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
