import { describe, expect, it, vi } from 'vitest'
import { deviceLocale } from './deviceLocale'

describe('deviceLocale', () => {
  it('picks French from browser languages', () => {
    vi.stubGlobal('navigator', { language: 'en-US', languages: ['fr-FR', 'en-US'] })
    expect(deviceLocale()).toBe('fr')
  })

  it('defaults to English', () => {
    vi.stubGlobal('navigator', { language: 'de-DE', languages: ['de-DE'] })
    expect(deviceLocale()).toBe('en')
  })
})
