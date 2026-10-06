import type { Me, Session } from './types'
import { currentT } from '../i18n/LocaleProvider'

/** Production API fallback when VITE_API_URL was not set at build time (set VITE_API_URL on Vercel). */
export const DEFAULT_REMOTE_API = 'https://game-finder-ddcm.onrender.com'

const LEGACY_API_HOSTS = new Set([
  'game-finder-api.fly.dev',
  'game-finder-api.onrender.com',
])

function viteApiUrl(): string | undefined {
  const raw = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '')
  if (!raw) return undefined
  try {
    if (LEGACY_API_HOSTS.has(new URL(raw).hostname)) return DEFAULT_REMOTE_API
  } catch {
    // ignore
  }
  return raw
}

export function apiOrigin(): string {
  const env = viteApiUrl()
  if (typeof window !== 'undefined') {
    const pageHost = window.location.hostname
    // Local Vite dev: always use the dev-server proxy (/api → localhost:8080), even when
    // root .env sets VITE_API_URL to production Render.
    if (import.meta.env.DEV && (pageHost === 'localhost' || pageHost === '127.0.0.1')) {
      return window.location.origin
    }
    const onLan = pageHost !== 'localhost' && pageHost !== '127.0.0.1'
    if (env && onLan && (env.includes('localhost') || env.includes('127.0.0.1'))) {
      try {
        const u = new URL(env)
        const port = u.port || '8080'
        return `${window.location.protocol}//${pageHost}:${port}`
      } catch {
        return `${window.location.protocol}//${pageHost}:8080`
      }
    }
    if (!env) {
      if (pageHost === 'localhost' || pageHost === '127.0.0.1') {
        return window.location.origin
      }
      // Production hosts (e.g. Vercel): call Render directly — /api rewrites share one egress IP.
      return DEFAULT_REMOTE_API
    }

    try {
      const api = new URL(env)
      const page = new URL(window.location.origin)
      const localApi = api.hostname === 'localhost' || api.hostname === '127.0.0.1'
      if (localApi && api.port === '8080' && page.port !== '8080' && page.hostname === api.hostname) {
        return window.location.origin
      }
    } catch {
      // ignore
    }
  }
  return env || 'http://localhost:8080'
}

export const API_URL =
  typeof window !== 'undefined' ? apiOrigin() : (viteApiUrl() || 'http://localhost:8080').replace(/\/$/, '')

const LEGACY_STORAGE_KEY = 'ftg.session'
/**
 * Refresh token kept in storage ONLY for browsers that block the API's cross-site cookies
 * (Safari/iOS, Brave, private windows): the web app (Vercel) and API (Render) are different
 * sites, so without this those users are signed out on their first request after login.
 */
const FALLBACK_REFRESH_KEY = 'ftg.rt'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Listener = (s: Session | null) => void
const listeners = new Set<Listener>()

/**
 * In-memory user + tokens. Auth normally rides on httpOnly cookies; the tokens from the
 * session response are also kept and sent as a Bearer header so sign-in still works when
 * the browser drops third-party cookies.
 */
let sessionUser: Me | null = null
let sessionTokens: { access_token?: string; refresh_token?: string; access_expires_at?: string } | null = null
/** Bumped on every session change so a slow bootstrap can't undo a newer sign-in. */
let sessionVersion = 0

function storedRefreshToken(): string | null {
  try {
    return localStorage.getItem(FALLBACK_REFRESH_KEY)
  } catch {
    return null
  }
}

function writeStoredRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(FALLBACK_REFRESH_KEY, token)
    else localStorage.removeItem(FALLBACK_REFRESH_KEY)
  } catch {
    // storage blocked: session lasts for this tab only
  }
}

/** True once we've seen that this browser doesn't send our session cookies. */
let cookieFallback = storedRefreshToken() !== null

try {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  // ignore
}

export function getSession(): Session | null {
  if (!sessionUser) return null
  return { user: sessionUser, ...sessionTokens }
}

export function setSession(s: Session | null) {
  sessionUser = s?.user ?? null
  sessionTokens =
    s?.access_token || s?.refresh_token
      ? {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          access_expires_at: s.access_expires_at,
        }
      : s
        ? sessionTokens
        : null
  sessionVersion++
  if (!s) {
    cookieFallback = false
    writeStoredRefreshToken(null)
  } else if (cookieFallback && s.refresh_token) {
    // Refresh tokens rotate on every use — keep the stored one current.
    writeStoredRefreshToken(s.refresh_token)
  }
  listeners.forEach((l) => l(getSession()))
}

/**
 * Start a session from a login / register / Google / Apple response, then check whether this
 * browser actually sends our cookies. If not, keep the refresh token so a reload stays signed in.
 */
export async function establishSession(s: Session): Promise<void> {
  setSession(s)
  try {
    const res = await fetch(`${apiOrigin()}/api/me`, { credentials: 'include' })
    if (res.status === 401) {
      cookieFallback = true
      if (sessionTokens?.refresh_token) writeStoredRefreshToken(sessionTokens.refresh_token)
    } else if (res.ok) {
      cookieFallback = false
      writeStoredRefreshToken(null)
    }
  } catch {
    // offline / API asleep: the Bearer token still works for this tab
  }
}

export function onSessionChange(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      // In fallback mode storage holds the newest token (another tab may have rotated it).
      const refresh_token = (cookieFallback ? storedRefreshToken() : null) ?? sessionTokens?.refresh_token ?? undefined
      const res = await fetch(`${apiOrigin()}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        // Cookie is used when the browser sends it; the body covers browsers that don't.
        body: refresh_token ? JSON.stringify({ refresh_token }) : undefined,
      })
      if (!res.ok) {
        setSession(null)
        return false
      }
      const data = (await res.json()) as Session
      setSession(data)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Bearer token from the last session response (cookies are the primary transport). */
export async function accessToken(): Promise<string | null> {
  const exp = sessionTokens?.access_expires_at
  if (exp && new Date(exp).getTime() - Date.now() < 30_000) {
    await refreshSession()
  }
  const tok = sessionTokens?.access_token ?? null
  if (tok && exp && new Date(exp).getTime() <= Date.now()) return null
  return tok
}

const TRANSIENT_AUTH_STATUSES = new Set([502, 503, 504])

/**
 * Login / register / OAuth token exchange. Never sends Authorization — a stale Bearer
 * token makes the global auth middleware reject the request before the handler runs.
 */
export async function exchangeSession(path: string, json: Record<string, unknown>): Promise<Session> {
  const post = async (): Promise<Session> => {
    const res = await fetch(`${apiOrigin()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? currentT().errors.generic)
    }
    return data as Session
  }
  try {
    return await post()
  } catch (e) {
    if (e instanceof ApiError && TRANSIENT_AUTH_STATUSES.has(e.status)) {
      await new Promise((r) => setTimeout(r, 900))
      return await post()
    }
    if (e instanceof TypeError) {
      await new Promise((r) => setTimeout(r, 900))
      return await post()
    }
    throw e
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  const token = await accessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${apiOrigin()}${path}`, { ...init, headers, body, credentials: 'include' })
  if (res.status === 401 && retry && sessionUser && (await refreshSession())) {
    return api<T>(path, init, false)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? currentT().errors.generic)
  }
  return data as T
}

/** Re-encode phone photos (HEIC, huge PNG) as JPEG so the API accepts them. */
async function prepareImageUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1600
    let w = bitmap.width
    let h = bitmap.height
    if (w > max || h > max) {
      if (w >= h) {
        h = Math.round((h * max) / w)
        w = max
      } else {
        w = Math.round((w * max) / h)
        h = max
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.88)
    })
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export async function uploadImage(file: File, kind: 'avatar' | 'court'): Promise<string> {
  const prepared = await prepareImageUpload(file)
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', prepared)
  const { url } = await api<{ url: string }>('/api/uploads', { method: 'POST', body: form })
  return url
}

/** Localized text for an API error code: exact-message variant, then the code's copy, then the server message. */
export function apiErrorText(e: ApiError): string {
  const t = currentT().errors
  const variants = t.variants as Record<string, Record<string, string> | undefined>
  const codes = t.codes as Record<string, string | undefined>
  const text = variants[e.code]?.[e.message] ?? codes[e.code]
  if (text) return text
  if (e.code.startsWith('invalid:')) return t.invalidValue
  return e.message || t.generic
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return apiErrorText(e)
  if (e instanceof TypeError) return currentT().errors.network
  return currentT().errors.generic
}

/** Restore the session on page load: cookies first, then the stored refresh token (cookie-blocking browsers). */
export async function bootstrapSession(): Promise<boolean> {
  const started = sessionVersion
  try {
    const me = await api<Me>('/api/me')
    // The user may have signed in while this was in flight (slow API wake-up) — keep that session.
    if (sessionVersion === started) setSession({ user: me })
    return true
  } catch {
    if (sessionVersion !== started) return !!sessionUser
    if (storedRefreshToken() && (await refreshSession())) return true
    if (sessionVersion === started) setSession(null)
    return !!sessionUser
  }
}

/** Refresh token to revoke on logout when cookies aren't available. */
export function currentRefreshToken(): string | undefined {
  return sessionTokens?.refresh_token ?? storedRefreshToken() ?? undefined
}
