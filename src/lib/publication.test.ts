import { describe, expect, it } from 'vitest'
import { PublicationStatus, UserRole } from '@prisma/client'
import { canViewProjectContent } from '@/lib/publication'

const OWN_UNIVERSITY = 'uni-1'
const OTHER_UNIVERSITY = 'uni-2'

const moderator = { role: UserRole.ADMIN, universityId: null }
const editor = { role: UserRole.EDITOR, universityId: null }
const rep = { role: UserRole.UNIVERSITY_REP, universityId: OWN_UNIVERSITY }
const otherRep = { role: UserRole.UNIVERSITY_REP, universityId: OTHER_UNIVERSITY }
const viewer = { role: UserRole.VIEWER, universityId: null }

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

  it('проект на проверке скрыт от посторонних', () => {
    const project = { universityId: OWN_UNIVERSITY, publication: PublicationStatus.REVIEW }
    expect(canViewProjectContent(otherRep, project)).toBe(false)
    expect(canViewProjectContent(viewer, project)).toBe(false)
    expect(canViewProjectContent(rep, project)).toBe(true)
  })
})
