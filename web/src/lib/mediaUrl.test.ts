import { describe, expect, it, vi } from 'vitest'
import { resolveMediaUrl } from './mediaUrl'

vi.mock('./api', () => ({
  apiOrigin: () => 'http://test.example:9099',
}))

describe('resolveMediaUrl', () => {
  it('rewrites stored localhost upload URLs to the current API origin', () => {
    expect(resolveMediaUrl('http://localhost:8080/uploads/court/u1/abc.jpg')).toBe(
      'http://test.example:9099/uploads/court/u1/abc.jpg',
    )
  })

  it('keeps relative upload paths', () => {
    expect(resolveMediaUrl('/uploads/court/u1/abc.jpg')).toBe('http://test.example:9099/uploads/court/u1/abc.jpg')
  })

  it('rewrites placeholder LAN hosts on upload paths', () => {
    expect(resolveMediaUrl('http://192.168.x.x:8080/uploads/avatar/u1/a.jpg')).toBe(
      'http://test.example:9099/uploads/avatar/u1/a.jpg',
    )
  })
})
