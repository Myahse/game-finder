import { describe, expect, it } from 'vitest'
import { isInAppBrowser, signInErrorText } from './firebase'

const ua = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A54; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0;]',
  androidWebView: 'Mozilla/5.0 (Linux; Android 13; TECNO; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36',
  iosWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
}

describe('isInAppBrowser', () => {
  it('lets real browsers through', () => {
    expect(isInAppBrowser(ua.iosSafari)).toBe(false)
    expect(isInAppBrowser(ua.iosChrome)).toBe(false)
    expect(isInAppBrowser(ua.androidChrome)).toBe(false)
  })
  it('spots app browsers', () => {
    expect(isInAppBrowser(ua.instagram)).toBe(true)
    expect(isInAppBrowser(ua.facebookAndroid)).toBe(true)
    expect(isInAppBrowser(ua.androidWebView)).toBe(true)
    expect(isInAppBrowser(ua.iosWebView)).toBe(true)
  })
})

describe('signInErrorText', () => {
  it('stays quiet when the player closes the window', () => {
    expect(signInErrorText({ code: 'auth/popup-closed-by-user' })).toBeNull()
    expect(signInErrorText({ code: 'auth/cancelled-popup-request' })).toBeNull()
  })
  it('explains known problems and keeps unknown codes', () => {
    expect(signInErrorText({ code: 'auth/popup-blocked' })).toMatch(/blocked/i)
    expect(signInErrorText({ code: 'auth/internal-error' })).toMatch(/\(internal-error\)$/)
  })
  it('leaves non-Firebase errors to the caller', () => {
    expect(signInErrorText(new Error('x'))).toBeUndefined()
  })
})
