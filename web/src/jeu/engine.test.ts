import { describe, expect, it } from 'vitest'
import { Match, WIN, type RosterEntry, type Attrs } from './engine'

const attrs = (v: number): Attrs => ({ tir: v, pen: v, col: v, def: v, end: v, men: v })
const team = (prefix: string, v: number): RosterEntry[] =>
  [0, 1, 2].map((i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}`, num: i + 1, big: i === 2, a: attrs(v) }))

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

describe('Mode Jeu engine', () => {
  it('plays a match to 15 with consistent stats', () => {
    const m = new Match([team('a', 70), team('b', 70)], { humanFor: () => null }, seeded(7))
    m.simulateToEnd()
    expect(m.finished).toBe(true)
    expect(Math.max(...m.score)).toBeGreaterThanOrEqual(WIN)
    expect(Math.min(...m.score)).toBeLessThan(WIN)
    for (const t of [0, 1] as const) {
      expect(m.team(t).reduce((s, p) => s + p.st.pts, 0)).toBe(m.score[t])
    }
    expect(m.moments.at(-1)?.k).toBe('win')
  })

  it('lets better players win more often', () => {
    let wins = 0
    for (let i = 0; i < 40; i++) {
      const m = new Match([team('a', 82), team('b', 55)], { humanFor: () => null }, seeded(100 + i))
      m.simulateToEnd()
      if (m.score[0] > m.score[1]) wins++
    }
    expect(wins).toBeGreaterThan(28)
  })

  it('waits for a human and takes their choice', () => {
    let clock = 0
    const m: Match = new Match([team('a', 70), team('b', 70)], { humanFor: (p): string | null => (p.team === m.off ? 'u1' : null), now: () => clock }, seeded(3))
    let guard = 0
    while (!m.aw && guard++ < 2000) m.update(0.05)
    const aw = m.aw!
    expect(aw.who).toBe('u1')
    expect(aw.list[0][0]).toBe('s')
    expect(m.choose(aw.q, 0, 'someone-else')).toBe(false)
    expect(m.choose(aw.q, 0, 'u1')).toBe(true)
    expect(m.aw).toBeNull()
    expect(m.phase).toBe('shot')
  })

  it('lets the AI play when an online player does not answer in time', () => {
    let clock = 0
    const m = new Match([team('a', 70), team('b', 70)], { humanFor: () => 'u2', now: () => clock }, seeded(5))
    let guard = 0
    while (!m.aw && guard++ < 2000) m.update(0.05)
    expect(m.aw).not.toBeNull()
    clock += 8000
    m.update(0.05)
    expect(m.aw).toBeNull()
    expect(m.feed[0].k).toBe('aiPlays')
  })
})
