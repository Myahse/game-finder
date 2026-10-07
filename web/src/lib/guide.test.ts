import { beforeEach, describe, expect, it } from 'vitest'
import { guideSeen, isNewPlayer, markGuideSeen, turnOffGuide } from './guide'

const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

describe('guide', () => {
  beforeEach(() => store.clear())

  it('shows each screen once', () => {
    expect(guideSeen('u1', 'map')).toBe(false)
    markGuideSeen('u1', 'map')
    expect(guideSeen('u1', 'map')).toBe(true)
    expect(guideSeen('u1', 'play')).toBe(false)
    expect(guideSeen('u2', 'map')).toBe(false)
  })

  it('skip turns off every screen', () => {
    turnOffGuide('u1')
    expect(guideSeen('u1', 'profile')).toBe(true)
  })

  it('only new players get tips', () => {
    const now = Date.parse('2026-10-07T12:00:00Z')
    expect(isNewPlayer('2026-10-01T12:00:00Z', now)).toBe(true)
    expect(isNewPlayer('2026-08-01T12:00:00Z', now)).toBe(false)
    expect(isNewPlayer(undefined, now)).toBe(false)
  })
})
