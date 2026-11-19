import { NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { NeedError } from '@/lib/need-builder/service'
import { MAX_TURNS } from '@/lib/need-builder/readiness'
import { t, type Lang } from '@/lib/i18n'

/** Помощник — для компаний; модераторы могут проверить его работу на себе. */
export const NEED_ROLES = [UserRole.BUSINESS_REP, UserRole.ADMIN, UserRole.EDITOR]

/** Ходов в час на пользователя: каждый ход — вызов модели и расход общей квоты Gemini. */
export const TURNS_PER_HOUR = 30

export function needErrorResponse(error: unknown, fallback: string, lang: Lang) {
  if (error instanceof NeedError) {
    switch (error.code) {
      case 'not_found':
        return NextResponse.json({ error: t('apiErrors', 'notFound', lang) }, { status: 404 })
      case 'closed':
        return NextResponse.json({ error: t('apiErrors', 'needClosed', lang) }, { status: 409 })
      case 'conflict':
        return NextResponse.json({ error: t('apiErrors', 'needConflict', lang) }, { status: 409 })
      case 'turn_limit':
        return NextResponse.json(
          { error: t('apiErrors', 'turnLimit', lang).replace('{max}', String(MAX_TURNS)) },
          { status: 409 },
        )
      case 'unavailable':
        return NextResponse.json({ error: t('apiErrors', 'unavailable', lang) }, { status: 503 })
      case 'sensitive': {
        const kinds = [...new Set(error.findings.map(f => f.kind))]
        const labels = kinds.map(kind => t('sensitive', kind, lang)).join(', ')
        return NextResponse.json({
          error: `${t('need', 'sensitivePre', lang)}${labels}${t('need', 'sensitivePost', lang)}`,
          findings: error.findings,
        }, { status: 422 })
      }
    }
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
