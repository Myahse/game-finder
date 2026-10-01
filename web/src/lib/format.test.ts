import { describe, expect, it } from 'vitest'
import { distanceM, formatDistance, timeAgo } from './format'

describe('format', () => {
  it('formats distances', () => {
    expect(formatDistance(1234)).toBe('1.2 km')
    expect(formatDistance(430)).toBe('430 m')
    expect(formatDistance(15_400)).toBe('15 km')
    expect(formatDistance(null)).toBe('')
  })

  it('computes haversine distance', () => {
    // IUGB → Cocody is roughly 29 km
    const d = distanceM(5.2133, -3.7389, 5.3483, -3.987)
    expect(d).toBeGreaterThan(28_000)
    expect(d).toBeLessThan(32_000)
  })

  it('describes last activity', () => {
    const now = Date.parse('2026-10-01T18:22:00Z')
    expect(timeAgo('2026-10-01T18:20:00Z', now)).toBe('2 minutes ago')
    expect(timeAgo('2026-10-01T18:21:50Z', now)).toBe('just now')
    expect(timeAgo(null, now)).toBe('No recent activity')
  })
})
