import { getApps, initializeApp } from 'firebase/app'
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { api } from './api'

function env(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? ''
}

const config = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN') || (env('VITE_FIREBASE_PROJECT_ID') ? `${env('VITE_FIREBASE_PROJECT_ID')}.firebaseapp.com` : ''),
}
/**
 * Web Push certificate public key (Firebase console → Cloud Messaging → Web Push certificates).
 * Public by design (it ships to every browser); VITE_FIREBASE_VAPID_KEY overrides it.
 */
const DEFAULT_VAPID_KEY = 'BBEZUnwRaDGdOz2EFjIAZhsttAzYuJq6SPsec_sYXY2eFxlPprkmmVrchpYWGydsBf4NT2alSRAxwNw7RjcrSec'
const vapidKey = env('VITE_FIREBASE_VAPID_KEY') || DEFAULT_VAPID_KEY
const TOKEN_KEY = 'ftg_web_push_token'

export const webPushConfigured = !!(config.apiKey && config.projectId && config.appId && config.messagingSenderId && vapidKey)

async function messaging() {
  if (!webPushConfigured || !('serviceWorker' in navigator) || !(await isSupported())) return null
  const app = getApps()[0] ?? initializeApp(config)
  return getMessaging(app)
}

/**
 * Registers this browser for push (FCM) and sends the token to the API.
 * Call after notification permission is granted; safe to call on every app start.
 * Returns false when push isn't available here (not configured, unsupported,
 * or iOS Safari outside the installed home-screen app).
 */
export async function registerWebPush(): Promise<boolean> {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    const m = await messaging()
    if (!m) return false
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return false
    await api('/api/me/push-tokens', { method: 'POST', json: { token, platform: 'web' } })
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // storage unavailable — token stays registered server-side
    }
    return true
  } catch (e) {
    console.warn('web push registration failed', e)
    return false
  }
}

/** On logout: stop pushes for the previous account on this device. */
export async function unregisterWebPush(): Promise<void> {
  let token: string | null = null
  try {
    token = localStorage.getItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
  if (!token) return
  await api('/api/me/push-tokens', { method: 'DELETE', json: { token } }).catch(() => {})
  const m = await messaging().catch(() => null)
  if (m) await deleteToken(m).catch(() => {})
}

/** Shows a system notification through the service worker (works on Android, unlike `new Notification`). */
export async function showSystemNotification(title: string, body: string, tag: string, link?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: '/favicon.svg', badge: '/favicon.svg', data: { link: link ?? '/notifications' } })
      return
    }
  } catch {
    // fall through to the page API (desktop)
  }
  try {
    new Notification(title, { body, tag, icon: '/favicon.svg' })
  } catch {
    // unsupported here
  }
}
