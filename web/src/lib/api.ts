import type { Me, Session } from './types'

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

/** In-memory user; auth tokens live in httpOnly cookies on the web. */
let sessionUser: Me | null = null
let sessionTokens: { access_token?: string; refresh_token?: string; access_expires_at?: string } | null = null

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
      : null
  listeners.forEach((l) => l(getSession()))
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
      const res = await fetch(`${apiOrigin()}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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

/** Bearer token when present (e.g. tests); web relies on cookies. */
export async function accessToken(): Promise<string | null> {
  const exp = sessionTokens?.access_expires_at
  if (exp && new Date(exp).getTime() - Date.now() < 30_000) {
    await refreshSession()
  }
  return sessionTokens?.access_token ?? null
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
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Something went wrong.')
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

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof TypeError) return "Can't reach the server. Check your connection."
  return 'Something went wrong.'
}

/** Restore session from httpOnly cookies (web bootstrap). */
export async function bootstrapSession(): Promise<boolean> {
  try {
    const me = await api<Me>('/api/me')
    setSession({ user: me })
    return true
  } catch {
    setSession(null)
    return false
  }
}
