/** Mapbox GL styles. Override with VITE_MAP_STYLE_LIGHT / VITE_MAP_STYLE_DARK if needed. */
export const MAPBOX_ACCESS_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim()

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
