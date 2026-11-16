import { describe, expect, it } from 'vitest'
import { IntegrationRequestStatus as S, UserRole } from '@prisma/client'
import {
  canChangeStatus, canSetProject, canViewRequest, canWriteUniversityNote, visibleRequestsWhere,
} from '@/lib/integration-requests'

const OWN = 'uni-1'
const OTHER = 'uni-2'

const admin = { id: 'admin', role: UserRole.ADMIN, universityId: null }
const editor = { id: 'editor', role: UserRole.EDITOR, universityId: null }
const rep = { id: 'rep', role: UserRole.UNIVERSITY_REP, universityId: OWN }
const otherRep = { id: 'rep-2', role: UserRole.UNIVERSITY_REP, universityId: OTHER }
const business = { id: 'biz', role: UserRole.BUSINESS_REP, universityId: null }
const otherBusiness = { id: 'biz-2', role: UserRole.BUSINESS_REP, universityId: null }
const viewer = { id: 'viewer', role: UserRole.VIEWER, universityId: OWN }

function request(overrides: Partial<{
  status: S; userId: string | null; forwardedAt: Date | null; projectId: string | null
}> = {}) {
  const projectId = overrides.projectId === undefined ? 'p-1' : overrides.projectId
  return {
    status: S.NEW,
    userId: business.id,
    forwardedAt: null,
    ...overrides,
    projectId,
    project: projectId ? { universityId: OWN } : null,
  }
}

const forwarded = (status: S = S.SENT_TO_UNIVERSITY) => request({ status, forwardedAt: new Date() })

describe('кто видит запрос', () => {
  it('оператор видит любой запрос', () => {
    for (const user of [admin, editor]) {
      expect(canViewRequest(user, request())).toBe(true)
      expect(visibleRequestsWhere(user)).toEqual({})
    }
  })

  it('компания видит только свои запросы', () => {
    expect(canViewRequest(business, request())).toBe(true)
    expect(canViewRequest(otherBusiness, request())).toBe(false)
    expect(visibleRequestsWhere(business)).toEqual({ userId: business.id })
  })

  it('вуз не видит запрос, пока оператор его не передал', () => {
    expect(canViewRequest(rep, request({ status: S.IN_REVIEW }))).toBe(false)
  })

  it('вуз не видит запрос, отклонённый оператором до передачи', () => {
    expect(canViewRequest(rep, request({ status: S.DECLINED }))).toBe(false)
  })

  it('вуз видит переданный запрос по своему проекту, даже если потом его отклонили', () => {
    expect(canViewRequest(rep, forwarded())).toBe(true)
    expect(canViewRequest(rep, forwarded(S.DECLINED))).toBe(true)
  })

  it('вуз не видит запросы по проектам чужого вуза', () => {
    expect(canViewRequest(otherRep, forwarded())).toBe(false)
    expect(visibleRequestsWhere(otherRep)).toEqual({
      forwardedAt: { not: null }, project: { universityId: OTHER },
    })
  })

  it('прочие роли запросов не видят', () => {
    expect(canViewRequest(viewer, forwarded())).toBe(false)
    expect(visibleRequestsWhere(viewer)).toEqual({ id: { in: [] } })
  })
})

describe('смена статуса', () => {
  it('оператор ведёт запрос по любому маршруту', () => {
    expect(canChangeStatus(admin, request(), S.IN_REVIEW)).toBe(true)
    expect(canChangeStatus(editor, request({ status: S.IN_REVIEW }), S.SENT_TO_UNIVERSITY)).toBe(true)
    expect(canChangeStatus(admin, request({ status: S.IN_REVIEW }), S.DECLINED)).toBe(true)
  })

  it('запрос без проекта нельзя передать вузу: неизвестно, какому', () => {
    expect(canChangeStatus(admin, request({ status: S.IN_REVIEW, projectId: null }), S.SENT_TO_UNIVERSITY)).toBe(false)
  })

  it('тот же статус — не переход', () => {
    expect(canChangeStatus(admin, request(), S.NEW)).toBe(false)
  })

  it('вуз берёт переданный запрос в работу, завершает или отклоняет', () => {
    expect(canChangeStatus(rep, forwarded(), S.IN_PROGRESS)).toBe(true)
    expect(canChangeStatus(rep, forwarded(), S.DECLINED)).toBe(true)
    expect(canChangeStatus(rep, forwarded(S.IN_PROGRESS), S.DONE)).toBe(true)
  })

  it('вуз не перескакивает этапы и не возвращает запрос оператору', () => {
    expect(canChangeStatus(rep, forwarded(), S.DONE)).toBe(false)
    expect(canChangeStatus(rep, forwarded(S.IN_PROGRESS), S.IN_REVIEW)).toBe(false)
    expect(canChangeStatus(rep, forwarded(S.DONE), S.IN_PROGRESS)).toBe(false)
  })

  it('вуз не трогает непереданный или чужой запрос', () => {
    expect(canChangeStatus(rep, request({ status: S.SENT_TO_UNIVERSITY }), S.IN_PROGRESS)).toBe(false)
    expect(canChangeStatus(otherRep, forwarded(), S.IN_PROGRESS)).toBe(false)
  })

  it('компания статусы не меняет', () => {
    expect(canChangeStatus(business, request(), S.IN_REVIEW)).toBe(false)
  })
})

describe('ответ вуза и привязка проекта', () => {
  it('ответ пишут вуз-получатель и оператор', () => {
    expect(canWriteUniversityNote(rep, forwarded())).toBe(true)
    expect(canWriteUniversityNote(admin, request())).toBe(true)
    expect(canWriteUniversityNote(rep, request())).toBe(false)
    expect(canWriteUniversityNote(otherRep, forwarded())).toBe(false)
    expect(canWriteUniversityNote(business, request())).toBe(false)
  })

  it('проект меняет только оператор и только до передачи вузу', () => {
    expect(canSetProject(admin, request({ projectId: null }))).toBe(true)
    expect(canSetProject(admin, forwarded())).toBe(false)
    expect(canSetProject(rep, forwarded())).toBe(false)
    expect(canSetProject(business, request())).toBe(false)
  })
})
