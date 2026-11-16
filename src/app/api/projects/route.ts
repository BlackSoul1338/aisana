import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { PublicationStatus, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PUBLISHED_ONLY, canModerate } from '@/lib/publication'
import { invalidateSearchIndex, loadSearchIndex, reclassifyProject } from '@/lib/search/store'
import { searchIndex } from '@/lib/search/engine'
import { canAccessUniversity, requireApiRole, requireApiUser } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { parseBody, projectSchema } from '@/lib/schemas'
import { publicationBlocker } from '@/lib/project-completeness'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireApiRole(request, [UserRole.ADMIN, UserRole.EDITOR, UserRole.UNIVERSITY_REP])
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const parsed = parseBody(projectSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const data = parsed.data
    const universityId = user.role === UserRole.UNIVERSITY_REP ? user.universityId : data.universityId

    if (!data.title || !data.description || !universityId) {
      return NextResponse.json({ error: 'Название, описание и вуз обязательны' }, { status: 400 })
    }

    if (!canAccessUniversity(user, universityId)) {
      return NextResponse.json({ error: 'Недостаточно прав для этого вуза' }, { status: 403 })
    }

    // Модерация: представитель вуза создаёт черновик — на портал проект
    // попадёт только после проверки. Администратор и редактор публикуют сразу.
    const publication = canModerate(user) ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT

    // Модератор публикует сразу, поэтому пустую карточку останавливаем здесь.
    // Черновик вуза может быть неполным: его проверят при отправке на проверку.
    if (publication === PublicationStatus.PUBLISHED) {
      const blocker = publicationBlocker(data, { requireImplementedAt: false })
      if (blocker) return NextResponse.json({ error: blocker }, { status: 400 })
    }

    // Бейджи «лучшая практика» и «к тиражированию» видны публично,
    // поэтому выдавать их может только модератор — представитель вуза
    // иначе назначал бы их себе сам.
    const maySetBadges = canModerate(user)

    const project = await prisma.project.create({
      data: {
        publication,
        publishedAt: publication === PublicationStatus.PUBLISHED ? new Date() : null,
        title: data.title,
        description: data.description,
        universityId,
        leadName: data.leadName || null,
        leadEmail: data.leadEmail || null,
        teamSize: data.teamSize ?? null,
        launchDate: data.launchDate ? new Date(data.launchDate) : null,
        category: data.category || 'EDUCATION',
        status: data.status || 'IDEA',
        industry: data.industry || null,
        implementedAt: data.implementedAt || null,
        isBestPractice: maySetBadges ? data.isBestPractice || false : false,
        isScalable: maySetBadges ? data.isScalable || false : false,
        impact: data.impact || null,
        results: data.results || null,
        presentationPdf: data.presentationPdf || null,
        presentationPptx: data.presentationPptx || null,
        zoomLink: data.zoomLink || null,
        videoUrl: data.videoUrl || null,
        documentation: data.documentation || null,
        tags: data.tags || [],
        technologies: data.technologyIds?.length
          ? { connect: data.technologyIds.map((id: string) => ({ id })) }
          : undefined,
      },
    })

    // Сразу раскладываем проект по тематическим направлениям
    await reclassifyProject(project.id, prisma).catch(err =>
      console.error('Не удалось классифицировать проект', project.id, err))
    invalidateSearchIndex()

    await audit(user, 'CREATE', 'project', project.id, project.title)
    revalidatePath(`/universities/${project.universityId}`)
    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Ошибка создания проекта' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Настоящая проверка сессии: middleware смотрит только наличие cookie
    const { response } = await requireApiUser(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const projects = await prisma.project.findMany({
      where: {
        ...PUBLISHED_ONLY,
        ...(status ? { status: status as any } : {}),
        ...(category ? { category: category as any } : {}),
      },
      include: {
        university: { include: { region: true } },
        technologies: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Текстовый запрос обрабатывает смысловой движок поиска,
    // а не совпадение подстроки: см. src/lib/search
    if (!q?.trim()) return NextResponse.json(projects)

    const index = await loadSearchIndex(prisma)
    const { hits } = searchIndex(index, q, { limit: 500 })
    const rank = new Map(hits.map((hit, position) => [hit.id, position]))

    const ranked = projects
      .filter(project => rank.has(project.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))

    return NextResponse.json(ranked)
  } catch {
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
