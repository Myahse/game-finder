import type { Session } from './types'

/** Fly API used when the static host has no VITE_API_URL at build time (e.g. Vercel misconfig). */
export const DEFAULT_REMOTE_API = 'https://game-finder-api.fly.dev'

/** API + upload host. Prefer same-origin (nginx/vite proxy); LAN-safe when env points at localhost. */
export function apiOrigin(): string {
  const env = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '')
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
      return DEFAULT_REMOTE_API
    }

    // Vite/nginx serve /api and /uploads on the app port; avoid broken :8080 image URLs in dev.
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

/** @deprecated use apiOrigin() — kept for imports that expect a string at load time */
export const API_URL = typeof window !== 'undefined' ? apiOrigin() : (import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8080').replace(/\/$/, '')

const STORAGE_KEY = 'ftg.session'

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

let session: Session | null = load()

function load(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function getSession() {
  return session
}

export function setSession(s: Session | null) {
  session = s
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable (private mode): keep the in-memory session
  }
  listeners.forEach((l) => l(s))
}

export function onSessionChange(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (!session) return false
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${apiOrigin()}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session!.refresh_token }),
      })
      if (!res.ok) {
        setSession(null)
        return false
      }
      setSession((await res.json()) as Session)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Returns a valid access token, refreshing it when it is about to expire. */
export async function accessToken(): Promise<string | null> {
  if (!session) return null
  if (new Date(session.access_expires_at).getTime() - Date.now() < 30_000) {
    await refreshSession()
  }
  return session?.access_token ?? null
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
  const res = await fetch(`${apiOrigin()}${path}`, { ...init, headers, body })
  if (res.status === 401 && retry && session && (await refreshSession())) {
    return api<T>(path, init, false)
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Something went wrong.')
  }
  return data as T
}

export async function uploadImage(file: File, kind: 'avatar' | 'court'): Promise<string> {
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', file)
  const { url } = await api<{ url: string }>('/api/uploads', { method: 'POST', body: form })
  return url
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof TypeError) return "Can't reach the server. Check your connection."
  return 'Something went wrong.'
}
