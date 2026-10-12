import { describe, expect, it } from 'vitest'
import { Match, type Attrs, type RosterEntry } from './engine'
import { RallyMatch, type NetSport } from './rally'

const attrs = (v: number): Attrs => ({ tir: v, pen: v, col: v, def: v, end: v, men: v })
const team = (prefix: string, v: number, n = 3): RosterEntry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}`, num: i + 1, big: i === 2, a: attrs(v) }))
function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

describe('football', () => {
  for (const n of [1, 2, 3]) {
    it(`plays ${n} against ${n} to 5 goals`, () => {
      const m = new Match([team('a', 70, n), team('b', 70, n)], { humanFor: () => null }, seeded(11 + n), 'football')
      m.simulateToEnd()
      expect(m.finished).toBe(true)
      expect(Math.max(...m.score)).toBe(5)
      for (const t of [0, 1] as const) expect(m.team(t).reduce((s, p) => s + p.st.pts, 0)).toBe(m.score[t])
      expect(m.P.every((p) => p.st.tpm === 0)).toBe(true)
    })
  }
  it('lets better players win more often', () => {
    let wins = 0
    for (let i = 0; i < 40; i++) {
      const m = new Match([team('a', 84), team('b', 55)], { humanFor: () => null }, seeded(300 + i), 'football')
      m.simulateToEnd()
      if (m.score[0] > m.score[1]) wins++
    }
    expect(wins).toBeGreaterThan(26)
  })
})

describe('net sports', () => {
  const sizes: Record<NetSport, number[]> = { volleyball: [1, 2, 3], tennis: [1, 2], badminton: [1, 2] }
  for (const sport of Object.keys(sizes) as NetSport[]) {
    for (const n of sizes[sport]) {
      it(`${sport} ${n} against ${n} reaches the winning score`, () => {
        const m = new RallyMatch(sport, [team('a', 70, n), team('b', 70, n)], { humanFor: () => null }, seeded(20 + n))
        m.simulateToEnd()
        expect(m.finished).toBe(true)
        expect(Math.max(...m.score)).toBe(sport === 'tennis' ? 7 : 11)
        expect(m.moments.at(-1)?.k).toBe('win')
      })
    }
    it(`${sport}: better players win more often`, () => {
      let wins = 0
      for (let i = 0; i < 40; i++) {
        const m = new RallyMatch(sport, [team('a', 84, 2), team('b', 55, 2)], { humanFor: () => null }, seeded(500 + i))
        m.simulateToEnd()
        if (m.score[0] > m.score[1]) wins++
      }
      expect(wins).toBeGreaterThan(26)
    })
    it(`${sport}: waits for a human hit and takes it`, () => {
      let clock = 0
      const m: RallyMatch = new RallyMatch(sport, [team('a', 70, 1), team('b', 70, 1)], { humanFor: (p) => (p.team === 0 ? 'u1' : null), now: () => clock }, seeded(9))
      let guard = 0
      while (!m.aw && !m.finished && guard++ < 20000) m.update(0.05)
      const aw = m.aw!
      expect(aw.who).toBe('u1')
      expect(aw.list).toHaveLength(3)
      expect(m.choose(aw.q, 0, 'u2')).toBe(false)
      expect(m.choose(aw.q, 0, 'u1')).toBe(true)
      expect(m.phase).toBe('flight')
      clock += 1
    })
  }
})

describe('probe', () => {
  it('prints match lengths', () => {
    const out: string[] = []
    for (const sport of ['football', 'volleyball', 'tennis', 'badminton'] as const) {
      let t = 0, rallies = 0
      for (let i = 0; i < 20; i++) {
        const m = sport === 'football' ? new Match([team('a', 70), team('b', 70)], { humanFor: () => null }, seeded(i + 1), 'football') : new RallyMatch(sport, [team('a', 70, 2), team('b', 70, 2)], { humanFor: () => null }, seeded(i + 1))
        m.simulateToEnd(); t += m.gameT; rallies += m.poss
      }
      out.push(`${sport}: ${(t / 20).toFixed(0)}s, ${(rallies / 20).toFixed(0)} poss`)
    }
    console.log(out.join('\n'))
  })
})
