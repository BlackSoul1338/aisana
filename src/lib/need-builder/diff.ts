import { FIELD_ORDER, type FieldState, type FieldStatus, type NeedFieldKey } from './readiness'

export type FieldChange = { field: NeedFieldKey; from: FieldStatus; to: FieldStatus; delta: number }

/** Что изменилось за ход: поле, статус до и после, прирост полноты (из Sana, `diff.ts`). */
export function fieldChanges(prev: FieldState[] | null, next: FieldState[]): FieldChange[] {
  if (!prev) return []
  return FIELD_ORDER.flatMap(key => {
    const a = prev.find(f => f.key === key)
    const b = next.find(f => f.key === key)
    if (!a || !b || a.status === b.status) return []
    return [{ field: key, from: a.status, to: b.status, delta: Math.round((b.earned - a.earned) * 10) / 10 }]
  })
}
