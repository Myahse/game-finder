import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'

function env(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? ''
}

const apiKey = env('VITE_FIREBASE_API_KEY')
const projectId = env('VITE_FIREBASE_PROJECT_ID')
const appId = env('VITE_FIREBASE_APP_ID')
const messagingSenderId = env('VITE_FIREBASE_MESSAGING_SENDER_ID')
const authDomain = env('VITE_FIREBASE_AUTH_DOMAIN') || (projectId ? `${projectId}.firebaseapp.com` : '')

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
