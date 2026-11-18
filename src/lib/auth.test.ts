import { describe, expect, it } from 'vitest'
import { hashSessionToken } from '@/lib/auth'

describe('hashSessionToken', () => {
  it('sha256 от токена: детерминировано, 64 hex, разные токены — разные хеши', () => {
    const hash = hashSessionToken('x'.repeat(64))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSessionToken('x'.repeat(64))).toBe(hash)
    expect(hashSessionToken('y'.repeat(64))).not.toBe(hash)
  })
})
