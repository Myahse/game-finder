import { describe, expect, it } from 'vitest'
import { countUpAt, easeOutCubic, prefersReducedMotion } from './motion'
import { burstOrigin, confettiPieces } from './celebrate'

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1 and front-loads the motion', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25)
  })
  it('clamps outside [0, 1]', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})

describe('countUpAt', () => {
  it('runs from → to over the duration, rounded', () => {
    expect(countUpAt(0, 100, 0, 400)).toBe(0)
    expect(countUpAt(0, 100, 200, 400)).toBe(88)
    expect(countUpAt(0, 100, 400, 400)).toBe(100)
    expect(countUpAt(0, 100, 9999, 400)).toBe(100)
  })
  it('counts down too, and lands exactly on the target', () => {
    expect(countUpAt(1200, 1180, 200, 400)).toBe(1183)
    expect(countUpAt(1200, 1180, 400, 400)).toBe(1180)
  })
  it('jumps straight to the target with no duration', () => {
    expect(countUpAt(5, 9, 0, 0)).toBe(9)
  })
})

describe('prefersReducedMotion', () => {
  it('is always false: motion plays for everyone', () => {
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('confettiPieces', () => {
  it('makes the requested number of pieces with bounded travel', () => {
    let seed = 0
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    const pieces = confettiPieces(24, rand)
    expect(pieces).toHaveLength(24)
    for (const p of pieces) {
      expect(Math.hypot(p.dx, p.dy)).toBeLessThan(200)
      expect(p.delay).toBeGreaterThanOrEqual(0)
      expect(p.delay).toBeLessThanOrEqual(60)
    }
    // Spread all the way round, not one direction.
    expect(pieces.some((p) => p.dx > 0)).toBe(true)
    expect(pieces.some((p) => p.dx < 0)).toBe(true)
  })
  it('handles zero / fractional counts', () => {
    expect(confettiPieces(0)).toEqual([])
    expect(confettiPieces(2.9)).toHaveLength(2)
  })
})

describe('burstOrigin', () => {
  it('uses the centre of an element', () => {
    const el = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 40 }) } as unknown as Element
    expect(burstOrigin(el)).toEqual({ x: 60, y: 40 })
  })
  it('passes points through', () => {
    expect(burstOrigin({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 })
  })
})
