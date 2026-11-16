import { NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { NeedError } from '@/lib/need-builder/service'
import { SENSITIVE_LABELS } from '@/lib/need-builder/sensitive'
import { MAX_TURNS } from '@/lib/need-builder/readiness'

/** Помощник — для компаний; модераторы могут проверить его работу на себе. */
export const NEED_ROLES = [UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR]

/** Ходов в час на пользователя: каждый ход — вызов модели и расход общей квоты Gemini. */
export const TURNS_PER_HOUR = 30

export function needErrorResponse(error: unknown, fallback: string) {
  if (error instanceof NeedError) {
    switch (error.code) {
      case 'not_found':
        return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
      case 'closed':
        return NextResponse.json({ error: 'Потребность уже отправлена оператору' }, { status: 409 })
      case 'conflict':
        return NextResponse.json({ error: 'Потребность изменилась в другой вкладке. Обновите страницу.' }, { status: 409 })
      case 'turn_limit':
        return NextResponse.json(
          { error: `Достигнут предел в ${MAX_TURNS} сообщений. Отправьте запрос оператору — он уточнит остальное.` },
          { status: 409 },
        )
      case 'unavailable':
        return NextResponse.json({
          error: 'Помощник сейчас не может разобрать сообщение. Попробуйте позже или отправьте запрос оператору — он уточнит задачу сам.',
        }, { status: 503 })
      case 'sensitive':
        return NextResponse.json({
          error: `Уберите из сообщения персональные данные (${[...new Set(error.findings.map(f => SENSITIVE_LABELS[f.kind]))].join(', ')}): текст передаётся внешней модели. Контакты оператор возьмёт из вашей учётной записи.`,
          findings: error.findings,
        }, { status: 422 })
    }
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
