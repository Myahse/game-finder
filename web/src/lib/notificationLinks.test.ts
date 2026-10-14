import { describe, expect, it } from 'vitest'
import { notificationLink } from './notificationLinks'

describe('notificationLink', () => {
  it('opens an announcement as a pop-up', () => {
    const id = '12a7209f-0e71-4750-b2b8-2959814178eb'
    expect(notificationLink({ type: 'system', data: { kind: 'announcement', announcement_id: id } })).toBe(`/?announcement=${id}`)
  })
  it('ignores a malformed announcement id', () => {
    expect(notificationLink({ type: 'system', data: { kind: 'announcement', announcement_id: '../x' } })).toBeUndefined()
  })
  it('still routes quest nudges to the play page', () => {
    expect(notificationLink({ type: 'achievement', data: { kind: 'quest' } })).toBe('/play')
  })
})
