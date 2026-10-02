/** Mapbox GL styles. Override with VITE_MAP_STYLE_LIGHT / VITE_MAP_STYLE_DARK if needed. */

const rawMapboxToken = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim()

/** Public tokens only (pk.*). Secret tokens (sk.*) must never be baked into the web bundle. */
export function normalizeMapboxToken(token: string): string {
  const t = token.trim()
  if (t.startsWith('sk.')) return ''
  return t
}

export const MAPBOX_ACCESS_TOKEN = normalizeMapboxToken(rawMapboxToken)

export function mapboxTokenSetupError(): string | null {
  if (!rawMapboxToken) return null
  if (rawMapboxToken.startsWith('sk.')) {
    return 'Vercel is using a secret Mapbox token (sk.*). Set VITE_MAPBOX_ACCESS_TOKEN to a public token (pk.*) from mapbox.com → Tokens, then redeploy.'
  }
  if (!rawMapboxToken.startsWith('pk.')) {
    return 'VITE_MAPBOX_ACCESS_TOKEN should be a public Mapbox token starting with pk.'
  }
  return null
}

export const MAP_STYLE_LIGHT =
  import.meta.env.VITE_MAP_STYLE_LIGHT ?? 'mapbox://styles/mapbox/streets-v12'

export const MAP_STYLE_DARK =
  import.meta.env.VITE_MAP_STYLE_DARK ?? 'mapbox://styles/mapbox/dark-v11'

export function mapboxConfigured(): boolean {
  return MAPBOX_ACCESS_TOKEN.length > 0
}

/** react-map-gl forwards these to mapbox-gl Map. EVENTS_URL is read-only in v3+; do not assign it. */
export const MAPBOX_MAP_PROPS = {
  performanceMetricsCollection: false,
} as const
