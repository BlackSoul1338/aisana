import { describe, expect, it } from 'vitest'
import { buildTechAliasMap } from '@/lib/project-import'
import { TECHNOLOGY_LABELS, TECHNOLOGY_SLUGS } from '@/lib/technologies'

describe('buildTechAliasMap', () => {
  it('подписи из kz-экспорта сводятся к своим slug, а не к новым технологиям', () => {
    const map = buildTechAliasMap()
    for (const slug of TECHNOLOGY_SLUGS) {
      const label = TECHNOLOGY_LABELS[slug]
      expect(map[label.ru.trim().toLowerCase()]?.slug, label.ru).toBe(slug)
      expect(map[label.kz.trim().toLowerCase()]?.slug, label.kz).toBe(slug)
    }
  })
})
