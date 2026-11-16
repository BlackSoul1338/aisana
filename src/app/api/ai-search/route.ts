import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiRole } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { loadSearchIndex } from '@/lib/search/store'
import { searchIndex } from '@/lib/search/engine'
import { aiSearchSchema, parseBody } from '@/lib/schemas'
import { generateMatchReasons, generateSearchSummary } from '@/lib/geminiSummary'
import { getLlmCacheStats } from '@/lib/llm-cache'

export const dynamic = 'force-dynamic'

/**
 * Смысловой поиск по проектам.
 *
 * Раньше здесь были два сырых SQL-запроса к полнотекстовому индексу и к
 * pg_trgm — ни того, ни другого в базе никогда не создавалось, оба запроса
 * молча падали в catch, и выдача формировалась одним грубым списком регулярок
 * по категориям. Отсюда и пропуски: находились не релевантные проекты,
 * а все проекты категории, на которую случайно сработала регулярка.
 *
 * Теперь ранжирование считает движок (src/lib/search): совпадение направлений
 * запроса и проекта плюс лексическое совпадение по всем текстовым полям.
 * Gemini используется только для человеческих формулировок поверх готовой
 * выдачи — на состав и порядок результатов он больше не влияет.
 */
export async function POST(request: NextRequest) {
  try {
    // Каждый запрос к Gemini тратит платную квоту, поэтому эндпоинт закрыт
    const { response: authError } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR])
    if (authError) return authError

    const ip = getClientIp(request)
    if (!rateLimit(`ai-search:${ip}`, 30, 60_000).ok) {
      return NextResponse.json(
        { error: 'Слишком много запросов, попробуйте через минуту' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const bodyParsed = parseBody(aiSearchSchema, body)
    if (!bodyParsed.success) {
      return NextResponse.json({ error: bodyParsed.error }, { status: 400 })
    }
    const query = bodyParsed.data.query
    const debug = bodyParsed.data.debug === true
    const limit = bodyParsed.data.limit ?? 50

    const index = await loadSearchIndex(prisma)
    const { query: parsed, hits } = searchIndex(index, query, { limit })

    if (hits.length === 0) {
      return NextResponse.json({
        query,
        count: 0,
        results: [],
        aiSummary: '',
        matchReasons: {},
        topics: parsed.topics,
        ...(debug ? { debug: { parsedQuery: parsed, note: 'Ни один проект не набрал минимальный балл' } } : {}),
      })
    }

    // Данные проектов подтягиваем одним запросом и возвращаем в порядке выдачи
    const ids = hits.map(hit => hit.id)
    const projects = await prisma.project.findMany({
      where: { id: { in: ids } },
      include: {
        technologies: true,
        university: { include: { region: true } },
      },
    })
    const byId = new Map(projects.map(project => [project.id, project]))

    const results = hits
      .map(hit => {
        const project = byId.get(hit.id)
        if (!project) return null
        return {
          ...project,
          searchScore: hit.score,
          topics: hit.topics.map(topic => ({
            topic: topic.topic,
            label: topic.label,
            score: topic.score,
            explanation: topic.explanation,
          })),
          matchReason: hit.debug.reason,
          ...(debug ? { debug: hit.debug } : {}),
        }
      })
      .filter(Boolean)

    // Честный счётчик попаданий: один адрес — один плюс проекту в час
    const countable = ids.filter(id => rateLimit(`hit:${ip}:${id}`, 1, 60 * 60 * 1000).ok)
    if (countable.length) {
      await prisma.project.updateMany({
        where: { id: { in: countable } },
        data: { searchHitCount: { increment: 1 } },
      }).catch(() => null)
    }

    // Пояснения от модели — поверх уже готовой выдачи, необязательны.
    // Проект мог быть удалён между сборкой индекса и запросом — тогда
    // его нет в byId, и он просто не попадает в пояснения.
    const [summary, reasons] = await Promise.all([
      generateSearchSummary(query, projects.map(p => ({ title: p.title, description: p.description }))),
      generateMatchReasons(query, hits.slice(0, 30).flatMap(hit => {
        const project = byId.get(hit.id)
        return project ? [{ id: hit.id, title: project.title, description: project.description }] : []
      })),
    ])

    // Эффективность кэша — в лог сервера, а не в ответ: клиенту она
    // ничего не даёт, а лишние поля в JSON — лишняя утечка деталей.
    console.info('LLM cache', getLlmCacheStats())

    return NextResponse.json({
      query,
      count: results.length,
      results,
      aiSummary: summary.data,
      matchReasons: reasons.data,
      // Пользователь должен видеть, что ИИ-часть недоступна, а не пустоту
      aiAvailable: summary.available && reasons.available,
      topics: parsed.topics,
      ...(debug ? { debug: { parsedQuery: parsed, indexSize: index.length } } : {}),
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 })
  }
}
