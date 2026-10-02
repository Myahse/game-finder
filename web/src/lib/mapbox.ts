import mapboxgl from 'mapbox-gl'

// Ad blockers block events.mapbox.com and flood the console; maps work fine without telemetry.
mapboxgl.config.EVENTS_URL = null

/** Mapbox GL styles. Override with VITE_MAP_STYLE_LIGHT / VITE_MAP_STYLE_DARK if needed. */
export const MAPBOX_ACCESS_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '').trim()

export const MAP_STYLE_LIGHT =
  import.meta.env.VITE_MAP_STYLE_LIGHT ?? 'mapbox://styles/mapbox/streets-v12'

export const MAP_STYLE_DARK =
  import.meta.env.VITE_MAP_STYLE_DARK ?? 'mapbox://styles/mapbox/dark-v11'

export function mapboxConfigured(): boolean {
  return MAPBOX_ACCESS_TOKEN.length > 0
}
