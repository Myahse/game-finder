import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, getRedirectResult, GoogleAuthProvider, OAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'
import { currentT } from '../i18n/LocaleProvider'

function env(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? ''
}

const apiKey = env('VITE_FIREBASE_API_KEY')
const projectId = env('VITE_FIREBASE_PROJECT_ID')
const appId = env('VITE_FIREBASE_APP_ID')
const messagingSenderId = env('VITE_FIREBASE_MESSAGING_SENDER_ID')
/**
 * Sites that serve Firebase's sign-in pages themselves (vercel.json proxies
 * /__/auth/ to Firebase, and Google allows their /__/auth/handler). Signing in
 * through our own domain shows it in the Google window and avoids Safari's
 * blocked third-party storage.
 */
const OWN_AUTH_HOSTS = new Set(['www.outforground.com'])
const ownHost = typeof window === 'undefined' ? '' : window.location.hostname
const authDomain = OWN_AUTH_HOSTS.has(ownHost)
  ? ownHost
  : env('VITE_FIREBASE_AUTH_DOMAIN') || (projectId ? `${projectId}.firebaseapp.com` : '')

export const firebaseAuthEnabled =
  apiKey !== '' && projectId !== '' && appId !== '' && messagingSenderId !== '' && authDomain !== ''

/** @deprecated use firebaseAuthEnabled */
export const firebaseGoogleEnabled = firebaseAuthEnabled

let app: FirebaseApp | null = null
let auth: Auth | null = null

function ensureFirebase(): Auth {
  if (!firebaseAuthEnabled) throw new Error('firebase not configured')
  if (!app) {
    app = getApps()[0] ?? initializeApp({
      apiKey,
      authDomain,
      projectId,
      appId,
      messagingSenderId,
    })
  }
  auth ??= getAuth(app)
  return auth
}

let warmed = false

/**
 * Load Firebase and its sign-in iframe before the first tap. Without this the
 * Google window opens only after that network work finishes, and on a slow
 * phone connection the browser no longer counts it as a tap and blocks it.
 */
export function prewarmFirebaseAuth(): void {
  if (warmed || !firebaseAuthEnabled) return
  warmed = true
  try {
    // getRedirectResult sets up the popup/redirect handler (its iframe) as a side effect.
    void getRedirectResult(ensureFirebase()).catch(() => {})
  } catch {
    warmed = false
  }
}

/** Firebase codes for a sign-in the player stopped themselves: say nothing. */
const CANCELLED = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])

function firebaseCode(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.startsWith('auth/') ? code : null
}

/**
 * Text for a failed Google / Apple sign-in window, or null when the player
 * closed it. Unknown codes keep the code so a screenshot tells us what broke.
 */
export function signInErrorText(e: unknown): string | null | undefined {
  const code = firebaseCode(e)
  if (!code) return undefined
  if (CANCELLED.has(code)) return null
  const t = currentT().errors
  switch (code) {
    case 'auth/popup-blocked':
      return t.signIn.popupBlocked
    case 'auth/network-request-failed':
      return t.network
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return t.signIn.unsupported
    case 'auth/unauthorized-domain':
      return t.signIn.unauthorizedDomain
    case 'auth/too-many-requests':
      return t.signIn.tooManyRequests
    default:
      console.warn('sign-in failed', code, e)
      return `${t.signIn.failed} (${code.slice(5)})`
  }
}

/** In-app browsers (Instagram, Facebook, TikTok…) where Google blocks sign-in. */
export function isInAppBrowser(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Snapchat|TikTok|musical_ly|BytedanceWebview|Line\/|LinkedInApp|Twitter|Pinterest/i.test(ua)) return true
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return true
  // iOS app web views leave out the "Safari/" token that Safari, Chrome and Firefox send.
  return /iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)
}

/** Google sign-in via Firebase Auth; returns a Firebase ID token for our API. */
export async function firebaseGoogleIdToken(): Promise<string> {
  const a = ensureFirebase()
  const cred = await signInWithPopup(a, new GoogleAuthProvider())
  const token = await cred.user.getIdToken()
  if (!token) throw new Error('no id token')
  return token
}

/** Apple sign-in via Firebase Auth (required on iOS App Store when other social logins exist). */
export async function firebaseAppleIdToken(): Promise<string> {
  const a = ensureFirebase()
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  const cred = await signInWithPopup(a, provider)
  const token = await cred.user.getIdToken()
  if (!token) throw new Error('no id token')
  return token
}

/** Set `VITE_ENABLE_APPLE_SIGN_IN=true` after Apple Developer + Firebase Apple auth are configured. */
export function isAppleSignInEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_APPLE_SIGN_IN === 'true'
}

export function preferAppleSignIn(): boolean {
  if (!isAppleSignInEnabled()) return false
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
