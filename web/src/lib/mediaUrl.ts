import { apiOrigin } from './api'

/** Extract `/uploads/...` from absolute or relative stored URLs. */
function uploadsPath(url: string): string | null {
  const trimmed = url.trim()
  if (trimmed.startsWith('/uploads/')) return trimmed
  try {
    const path = new URL(trimmed, 'http://local').pathname
    if (path.startsWith('/uploads/')) return path
  } catch {
    // ignore
  }
  return null
}

function isTrustedMediaHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  const configured = import.meta.env.VITE_MEDIA_PUBLIC_ORIGIN?.trim()
  if (configured) {
    try {
      if (new URL(configured).hostname.toLowerCase() === h) return true
    } catch {
      // ignore
    }
  }
  return h.endsWith('.r2.dev') || h.endsWith('.r2.cloudflarestorage.com')
}

function rewritableHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (!h || h === 'localhost' || h.startsWith('127.')) return true
  if (h.includes('example.com') || h.includes('placeholder') || h.includes('your-api')) return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
}

/** Same rules as mobile `resolveMediaUrl` — always load uploads from the API the browser uses. */
export function resolveMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed
  const base = apiOrigin()

  const upload = uploadsPath(trimmed)
  if (upload) return `${base}${upload}`

  if (trimmed.startsWith('/')) return `${base}${trimmed}`

  try {
    const uri = new URL(trimmed, base)
    if (uri.pathname.startsWith('/uploads/')) {
      return `${base}${uri.pathname}${uri.search}`
    }
    if (uri.protocol === 'https:' && isTrustedMediaHost(uri.hostname)) {
      return trimmed
    }
    if (!uri.host || rewritableHost(uri.hostname)) {
      return `${base}${uri.pathname}${uri.search}`
    }
    return ''
  } catch {
    return `${base}/${trimmed.replace(/^\/+/, '')}`
  }
}

export function courtPhotoUrl(photos: string[] | null | undefined): string | null {
  const raw = photos?.[0]
  if (!raw) return null
  return resolveMediaUrl(raw)
}
