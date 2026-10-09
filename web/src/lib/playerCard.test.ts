import { describe, expect, it } from 'vitest'
import { cardNameLines, formatEloDelta, formatSerial, tierColor } from './playerCard'
import { notificationLink } from './notificationLinks'

describe('player card helpers', () => {
  it('pads serial numbers to 4 digits', () => {
    expect(formatSerial(42)).toBe('0042')
    expect(formatSerial(1)).toBe('0001')
    expect(formatSerial(12345)).toBe('12345')
    expect(formatSerial(0)).toBe('0000')
  })

  it('signs Elo changes', () => {
    expect(formatEloDelta(64)).toBe('+64')
    expect(formatEloDelta(-12.4)).toBe('−12')
    expect(formatEloDelta(0)).toBe('±0')
  })

  it('maps tiers to frame colours, bronze by default', () => {
    expect(tierColor('feu')).toBe('#ff5a1f')
    expect(tierColor('or')).toBe('#f2b632')
    expect(tierColor('argent')).toBe('#c9ced6')
    expect(tierColor('bronze')).toBe('#cd7f4b')
    expect(tierColor(undefined)).toBe('#cd7f4b')
  })

  it('prints the legal name only when allowed', () => {
    const u = { username: 'ama.k', first_name: 'Ama', last_name: 'Kouamé' }
    expect(cardNameLines(u, true)).toEqual(['AMA', 'KOUAMÉ'])
    expect(cardNameLines(u, false)).toEqual(['AMA.K'])
    expect(cardNameLines({ ...u, first_name: '', last_name: '' }, true)).toEqual(['AMA.K'])
  })

  it('opens the own card from a tier-up notification', () => {
    expect(notificationLink({ type: 'achievement', data: { kind: 'card_tier', tier: 'or', sport: 'basketball' } })).toBe('/profile?card=basketball')
    expect(notificationLink({ type: 'achievement', data: { kind: 'badge' } })).toBe('/profile')
  })
})
