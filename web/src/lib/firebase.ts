import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'

function env(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? ''
}

const apiKey = env('VITE_FIREBASE_API_KEY')
const projectId = env('VITE_FIREBASE_PROJECT_ID')
const appId = env('VITE_FIREBASE_APP_ID')
const messagingSenderId = env('VITE_FIREBASE_MESSAGING_SENDER_ID')
const authDomain = env('VITE_FIREBASE_AUTH_DOMAIN') || (projectId ? `${projectId}.firebaseapp.com` : '')

export const firebaseGoogleEnabled =
  apiKey !== '' && projectId !== '' && appId !== '' && messagingSenderId !== '' && authDomain !== ''

let app: FirebaseApp | null = null
let auth: Auth | null = null

function ensureFirebase(): Auth {
  if (!firebaseGoogleEnabled) throw new Error('firebase not configured')
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
