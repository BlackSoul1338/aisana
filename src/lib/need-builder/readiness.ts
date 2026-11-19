/**
 * Потребность бизнеса: семь полей и полнота их описания.
 *
 * Перенесено из Business Challenge Builder (Sana, `challenge-builder/readiness.ts`).
 * Там поля описывали задачу для студентов, здесь — то, что нужно знать, чтобы
 * подобрать готовое университетское решение. Полнота — не зрелость решения:
 * она говорит только о том, насколько подробно компания описала свою задачу.
 */

import { t } from '../i18n'

export type NeedFieldKey = 'task' | 'problem' | 'goal' | 'data' | 'environment' | 'integrations' | 'scale'
export type FieldStatus = 'ok' | 'weak' | 'missing'

export const FIELD_ORDER: NeedFieldKey[] = ['task', 'problem', 'goal', 'data', 'environment', 'integrations', 'scale']

/** Веса полей, сумма 100: тяжелее всего то, без чего решение не подобрать. */
export const FIELD_WEIGHTS: Record<NeedFieldKey, number> = {
  task: 20,
  data: 20,
  problem: 15,
  goal: 15,
  environment: 10,
  integrations: 10,
  scale: 10,
}

export const STATUS_FACTOR: Record<FieldStatus, number> = { ok: 1, weak: 0.5, missing: 0 }

/** После этого порога предлагается отправить потребность оператору. Не блокирует. */
export const READY_THRESHOLD = 80
/** Жёсткий предел ходов диалога: защита от бесконечной переписки и расхода квоты. */
export const MAX_TURNS = 12

export const NOT_SPECIFIED = 'не указано'
export const NOT_SPECIFIED_KZ = 'көрсетілмеген'

/** Подписи полей — один словарь в i18n (need.field*), чтобы ru/kz не разъезжались. */
export const NEED_FIELD_I18N: Record<NeedFieldKey, string> = {
  task: 'fieldTask', problem: 'fieldProblem', goal: 'fieldGoal', data: 'fieldData',
  environment: 'fieldEnvironment', integrations: 'fieldIntegrations', scale: 'fieldScale',
}

export function fieldTitle(key: NeedFieldKey, lang: 'ru' | 'kz'): string {
  return t('need', NEED_FIELD_I18N[key], lang)
}

export type RawField = { key: NeedFieldKey; status: FieldStatus; value: string; quote: string; quoteVerified: boolean }
export type FieldState = RawField & { weight: number; earned: number }

/** Полноту считает код: «есть» — полный вес, «слабо» — половина, «нет» — ноль. */
export function scoreFields(fields: RawField[]): { readiness: number; fields: FieldState[] } {
  const scored = FIELD_ORDER.map(key => {
    const field = fields.find(f => f.key === key)
      ?? { key, status: 'missing' as const, value: NOT_SPECIFIED, quote: '', quoteVerified: false }
    const weight = FIELD_WEIGHTS[key]
    return { ...field, weight, earned: weight * STATUS_FACTOR[field.status] }
  })
  return { readiness: Math.round(scored.reduce((sum, f) => sum + f.earned, 0)), fields: scored }
}
