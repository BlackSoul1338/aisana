// Единая шкала заливки карты Казахстана: одна легенда, одна getMapColor —
// иначе оттенки и подписи приходится синхронизировать руками в двух файлах.
export const MAP_SCALE = [
  { max: 0, color: 'var(--map-0)', label: '0' },
  { max: 5, color: 'var(--map-1)', label: '1–5' },
  { max: 15, color: 'var(--map-2)', label: '6–15' },
  { max: 30, color: 'var(--map-3)', label: '16–30' },
  { max: Infinity, color: 'var(--map-4)', label: '30+' },
] as const

export function getMapColor(count: number): string {
  for (const level of MAP_SCALE) {
    if (count <= level.max) return level.color
  }
  return MAP_SCALE[MAP_SCALE.length - 1].color
}
