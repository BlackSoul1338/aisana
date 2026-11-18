import { BusinessNeedStatus, IntegrationRequestType, PublicationStatus, type BusinessNeed, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { analyzeDialog, type DialogMessage } from './analyze'
import type { NeedLang } from './questions'
import { fieldChanges, type FieldChange } from './diff'
import { matchProjects, needQuery, type NeedMatch } from './match'
import { questionsMessage, selectQuestions, type Question } from './questions'
import { verifyAnalysis } from './quotes'
import { MAX_TURNS, scoreFields, type FieldState } from './readiness'
import { findSensitive, type Finding } from './sensitive'
import { needSummary } from './summary'

export type NeedSnapshot = { turn: number; readiness: number }

export type NeedView = {
  id: string
  status: BusinessNeedStatus
  turnCount: number
  readiness: number
  messages: DialogMessage[]
  fields: FieldState[]
  snapshots: NeedSnapshot[]
  createdAt: Date
}

export type TurnResult = {
  need: NeedView
  changes: FieldChange[]
  questions: Question[]
  matches: NeedMatch[]
}

export type NeedErrorCode = 'not_found' | 'closed' | 'turn_limit' | 'sensitive' | 'conflict' | 'unavailable'

export class NeedError extends Error {
  constructor(public code: NeedErrorCode, public findings: Finding[] = []) {
    super(code)
  }
}

export function toView(need: BusinessNeed): NeedView {
  return {
    id: need.id,
    status: need.status,
    turnCount: need.turnCount,
    readiness: need.readiness,
    messages: need.messages as DialogMessage[],
    fields: need.fields as FieldState[],
    snapshots: need.snapshots as NeedSnapshot[],
    createdAt: need.createdAt,
  }
}

const businessTexts = (messages: DialogMessage[]) => messages.filter(m => m.role === 'user').map(m => m.text)

/** Потребность владельца; чужая неотличима от несуществующей. */
export async function getNeed(id: string, userId: string): Promise<NeedView | null> {
  const need = await prisma.businessNeed.findFirst({ where: { id, userId } })
  return need ? toView(need) : null
}

export async function needMatches(view: NeedView): Promise<NeedMatch[]> {
  return matchProjects(prisma, needQuery(view.fields, businessTexts(view.messages)))
}

/**
 * Ход диалога (алгоритм из Sana, `challenge-builder/service.ts`):
 * проверка ПДн → разбор всего диалога моделью → сверка цитат → полнота и
 * вопросы считает код. Запись — с оптимистичной блокировкой по turnCount,
 * чтобы два параллельных хода не затёрли друг друга.
 */
export async function takeTurn(needId: string, userId: string, text: string, lang: NeedLang = 'ru'): Promise<TurnResult> {
  const need = await prisma.businessNeed.findFirst({ where: { id: needId, userId } })
  if (!need) throw new NeedError('not_found')
  if (need.status !== BusinessNeedStatus.COLLECTING) throw new NeedError('closed')
  if (need.turnCount >= MAX_TURNS) throw new NeedError('turn_limit')

  // До вызова модели: текст с персональными данными в Gemini не уходит
  const findings = findSensitive(text)
  if (findings.length) throw new NeedError('sensitive', findings)

  const prev = toView(need)
  const turn = prev.turnCount + 1
  const messages: DialogMessage[] = [...prev.messages, { role: 'user', text }]

  // Без разбора ход не засчитывается: иначе недоступная модель съела бы лимит ходов
  const ai = await analyzeDialog(messages, lang)
  if (!ai) throw new NeedError('unavailable')
  const { fields, readiness } = scoreFields(verifyAnalysis(ai, businessTexts(messages)))
  const questions = selectQuestions({ fields, aiQuestions: ai.questions, turn, lang })
  const reply = questionsMessage(questions, lang)

  const nextMessages: DialogMessage[] = [...messages, { role: 'assistant', text: reply }]
  const snapshots: NeedSnapshot[] = [...prev.snapshots, { turn, readiness }]
  const updated = await prisma.businessNeed.updateMany({
    where: { id: need.id, turnCount: need.turnCount, status: BusinessNeedStatus.COLLECTING },
    data: {
      turnCount: turn,
      readiness,
      messages: nextMessages as unknown as Prisma.InputJsonValue,
      fields: fields as unknown as Prisma.InputJsonValue,
      snapshots: snapshots as unknown as Prisma.InputJsonValue,
    },
  })
  if (updated.count === 0) throw new NeedError('conflict')

  const view: NeedView = { ...prev, turnCount: turn, readiness, messages: nextMessages, fields, snapshots }
  return {
    need: view,
    changes: fieldChanges(prev.fields.length ? prev.fields : null, fields),
    questions,
    matches: await needMatches(view),
  }
}

/** Новая потребность сразу с первым сообщением компании. */
export async function createNeed(userId: string, text: string, lang: NeedLang = 'ru'): Promise<TurnResult> {
  // Проверяем до создания строки, чтобы не оставлять пустых потребностей
  const findings = findSensitive(text)
  if (findings.length) throw new NeedError('sensitive', findings)
  const need = await prisma.businessNeed.create({ data: { userId }, select: { id: true } })
  try {
    return await takeTurn(need.id, userId, text, lang)
  } catch (error) {
    // Первый ход не удался (модель недоступна) — пустая потребность не нужна
    await prisma.businessNeed.delete({ where: { id: need.id } }).catch(() => {})
    throw error
  }
}

type Sender = { id: string; name: string | null; email: string; organization: string | null }

/**
 * Отправка оператору: запрос типа «Консультация» со сводкой подтверждённых
 * полей. Проект необязателен — без него оператор подберёт решение сам.
 */
export async function sendNeed(
  needId: string,
  user: Sender,
  input: { projectId?: string | null; comment?: string | null; contactPhone?: string | null },
  lang: NeedLang = 'ru',
): Promise<{ requestId: string; projectTitle: string | null }> {
  const need = await prisma.businessNeed.findFirst({ where: { id: needId, userId: user.id } })
  if (!need) throw new NeedError('not_found')
  if (need.status !== BusinessNeedStatus.COLLECTING) throw new NeedError('closed')

  let project: { id: string; title: string } | null = null
  if (input.projectId) {
    project = await prisma.project.findFirst({
      where: { id: input.projectId, publication: PublicationStatus.PUBLISHED },
      select: { id: true, title: true },
    })
    if (!project) throw new NeedError('not_found')
  }

  const view = toView(need)
  const requestId = await prisma.$transaction(async tx => {
    const closed = await tx.businessNeed.updateMany({
      where: { id: need.id, status: BusinessNeedStatus.COLLECTING },
      data: { status: BusinessNeedStatus.SENT },
    })
    if (closed.count === 0) throw new NeedError('conflict')
    const created = await tx.integrationRequest.create({
      data: {
        projectId: project?.id ?? null,
        needId: need.id,
        userId: user.id,
        contactName: user.name,
        contactEmail: user.email,
        organization: user.organization,
        contactPhone: input.contactPhone ?? null,
        type: IntegrationRequestType.CONSULTATION,
        message: needSummary(view.fields, view.readiness, input.comment, lang),
      },
      select: { id: true },
    })
    return created.id
  })
  return { requestId, projectTitle: project?.title ?? null }
}
