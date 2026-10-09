import { describe, expect, it } from 'vitest'
import { BOARD_PIN, base, fillLabel, fitSize, interBase, letterOffsets, polyPath, recordLayout, scalePath, shieldPath } from './playerCardLayout'

describe('player card layout helpers', () => {
  it('fills label placeholders, blank when missing', () => {
    expect(fillLabel('LVL {n}', { n: 12 })).toBe('LVL 12')
    expect(fillLabel('PASS {tier} {x}', { tier: 'GOLD' })).toBe('PASS GOLD ')
  })

  it('shrinks a font size until the text fits, down to a minimum', () => {
    const width = (px: number) => px * 10
    expect(fitSize(width, 44, 500)).toBe(44)
    expect(fitSize(width, 44, 321)).toBe(32)
    expect(fitSize(width, 44, 50, 20)).toBe(20)
  })

  it('places baselines like the canvas export', () => {
    expect(base(22, 84, 0.82)).toBeCloseTo(90.04)
    expect(interBase(161.3, 11)).toBeCloseTo(171.959)
  })

  it('draws the shield outline (clipped top corners, pointed bottom)', () => {
    expect(shieldPath(0, 0, 100, 200, 10, 30)).toBe('M10 0L90 0L100 10L100 170L50 200L0 170L0 10Z')
    expect(polyPath(5, 5, [[0, 0], [1, 2]])).toBe('M5 5L6 7Z')
  })

  it('scales a pair-only path', () => {
    expect(scalePath('M32 2C15.4 2 2 15.2 2 31.5s30-18 30-38.5z', 2, 0.5)).toBe('M64 1C30.8 1 4 7.6 4 15.75s60-9 60-19.25z')
    // Every number of the scoreboard pin is scaled (x by sx, y by sy).
    expect(scalePath(BOARD_PIN, 1, 1)).toBe(BOARD_PIN)
  })

  it('spreads the scoreboard record across the panel', () => {
    expect(recordLayout(60, 60, 20)).toEqual({ x1: 38 + 189 / 6, xc: 38 + 189 / 6 + 60 + 63, x2: 38 + 189 / 6 + 60 + 63 + 20 + 63 })
    // No free room: columns sit edge to edge.
    expect(recordLayout(200, 200, 20)).toEqual({ x1: 38, xc: 238, x2: 258 })
  })

  it('gives each letter its prefix width', () => {
    expect(letterOffsets('ABC', (p) => p.length * 10)).toEqual([0, 10, 20])
    expect(letterOffsets('', (p) => p.length)).toEqual([])
  })
})
