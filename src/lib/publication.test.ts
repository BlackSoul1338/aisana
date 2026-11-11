import { describe, expect, it } from 'vitest'
import { PublicationStatus, UserRole } from '@prisma/client'
import { canViewProjectContent, visibleProjectsWhere, visibilityScope } from '@/lib/publication'

const OWN_UNIVERSITY = 'uni-1'
const OTHER_UNIVERSITY = 'uni-2'

const moderator = { role: UserRole.ADMIN, universityId: null }
const editor = { role: UserRole.EDITOR, universityId: null }
const rep = { role: UserRole.UNIVERSITY_REP, universityId: OWN_UNIVERSITY }
const otherRep = { role: UserRole.UNIVERSITY_REP, universityId: OTHER_UNIVERSITY }
const viewer = { role: UserRole.VIEWER, universityId: null }
// VIEWER с привязанным вузом: роль не даёт ему доступа к черновикам
const viewerWithUniversity = { role: UserRole.VIEWER, universityId: OWN_UNIVERSITY }

describe('видимость содержимого проекта', () => {
  it('опубликованный проект виден всем', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.PUBLISHED }
    for (const user of [moderator, editor, rep, otherRep, viewer]) {
      expect(canViewProjectContent(user, project)).toBe(true)
    }
  })

  it('черновик виден модераторам', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.DRAFT }
    expect(canViewProjectContent(moderator, project)).toBe(true)
    expect(canViewProjectContent(editor, project)).toBe(true)
  })

  it('черновик виден представителю своего вуза', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.DRAFT }
    expect(canViewProjectContent(rep, project)).toBe(true)
  })

  it('черновик чужого вуза не виден', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.DRAFT }
    expect(canViewProjectContent(otherRep, project)).toBe(false)
    expect(canViewProjectContent(viewer, project)).toBe(false)
  })

  it('VIEWER с привязанным вузом не видит черновики', () => {
    // Поле universityId есть у любой учётки, поэтому роль проверяется
    // обязательно — иначе VIEWER получил бы доступ к чужим черновикам
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.DRAFT }
    expect(canViewProjectContent(viewerWithUniversity, project)).toBe(false)
  })

  it('проект на проверке скрыт от посторонних', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.REVIEW }
    expect(canViewProjectContent(otherRep, project)).toBe(false)
    expect(canViewProjectContent(viewer, project)).toBe(false)
    expect(canViewProjectContent(rep, project)).toBe(true)
  })
})

describe('фильтр видимых проектов', () => {
  it('модератору фильтр не ограничивает', () => {
    expect(visibleProjectsWhere(moderator)).toEqual({})
    expect(visibleProjectsWhere(editor)).toEqual({})
  })

  it('представителю вуза — опубликованные и проекты своего вуза', () => {
    expect(visibleProjectsWhere(rep)).toEqual({
      OR: [
        { publication: PublicationStatus.PUBLISHED },
        { universityId: OWN_UNIVERSITY },
      ],
    })
  })

  it('постороннему без своего вуза — только опубликованные', () => {
    // У VIEWER нет своей квоты на черновики, даже если universityId заполнен
    for (const user of [viewer, viewerWithUniversity]) {
      const where = visibleProjectsWhere(user)
      expect(where.OR).toEqual([{ publication: PublicationStatus.PUBLISHED }])
    }
  })

  it('представитель чужого вуза не видит чужих черновиков', () => {
    // Свой вуз он видит, а чужие — нет: в фильтре только его universityId
    const where = visibleProjectsWhere(otherRep)
    expect(where.OR).toEqual([
      { publication: PublicationStatus.PUBLISHED },
      { universityId: OTHER_UNIVERSITY },
    ])
  })
})

describe('область видимости для кэша', () => {
  it('у модератора и постороннего разные области', () => {
    expect(visibilityScope(moderator)).toBe('all')
    expect(visibilityScope(viewer)).toBe('published')
  })

  it('у представителей вузов область своя', () => {
    expect(visibilityScope(rep)).toBe(`university:${OWN_UNIVERSITY}`)
    expect(visibilityScope(otherRep)).toBe(`university:${OTHER_UNIVERSITY}`)
  })
})
