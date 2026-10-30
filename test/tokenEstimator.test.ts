import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { estimateTokens } from '../electron/tokenEstimator'

describe('tokenEstimator', () => {
  // Feature: sakai-hub, Property 20: Token estimation accuracy (4 chars/token model)
  it('Property 20: estimate equals ceil(length / 4)', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const est = estimateTokens(text)
        const expected = text.length === 0 ? 0 : Math.ceil(text.length / 4)
        expect(est).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('is monotonic — longer text never has fewer tokens', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const longer = a.length >= b.length ? a : b
        const shorter = a.length >= b.length ? b : a
        expect(estimateTokens(longer)).toBeGreaterThanOrEqual(estimateTokens(shorter))
      }),
      { numRuns: 100 }
    )
  })
})
