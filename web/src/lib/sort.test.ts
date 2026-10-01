import { describe, expect, it } from 'vitest'
import { sortPlayable } from './sort'
import type { Game } from './types'

const g = (id: string, distance_m: number, player_count: number, spots_left: number, status: Game['status'] = 'active') =>
  ({ id, distance_m, player_count, spots_left, status }) as Game

describe('sortPlayable', () => {
  it('orders by distance, then activity, then available spots', () => {
    const out = sortPlayable([
      g('far', 2100, 6, 4),
      g('near-small', 1200, 2, 8),
      g('near-big', 1210, 8, 2),
      g('near-scheduled', 1100, 9, 1, 'scheduled'),
    ])
    expect(out.map((x) => x.id)).toEqual(['near-big', 'near-small', 'near-scheduled', 'far'])
  })

  it('drops finished and cancelled games', () => {
    expect(sortPlayable([g('a', 1, 1, 1, 'completed'), g('b', 1, 1, 1, 'cancelled')])).toEqual([])
  })

  it('prefers more spots when distance and players tie', () => {
    expect(sortPlayable([g('a', 500, 4, 1), g('b', 510, 4, 6)]).map((x) => x.id)).toEqual(['b', 'a'])
  })
})
