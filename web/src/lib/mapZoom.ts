/** Mapbox GL supports roughly 0 (world) through 22 (building detail). */
export const MAP_MIN_ZOOM = 0
export const MAP_MAX_ZOOM = 22

export function clampMapZoom(zoom: number): number {
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom))
}
