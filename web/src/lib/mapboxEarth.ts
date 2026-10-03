import type { Map as MapboxMap } from 'mapbox-gl'

/** Street-level maps use Mercator so pins sit on true coordinates (globe skews on mobile Safari). */
const LOCAL_ZOOM = 10

const GLOBE_FOG = {
  color: 'rgb(186, 210, 235)',
  'high-color': 'rgb(36, 92, 223)',
  'horizon-blend': 0.04,
  'space-color': 'rgb(11, 11, 25)',
  'star-intensity': 0.35,
} as const

function applyMapProjection(map: MapboxMap) {
  const local = map.getZoom() >= LOCAL_ZOOM
  try {
    map.setProjection({ name: local ? 'mercator' : 'globe' })
  } catch {
    // ignore on unsupported builds
  }
  try {
    if (local) map.setFog({})
    else map.setFog(GLOBE_FOG)
  } catch {
    // ignore
  }
}

/** Globe when zoomed out; Mercator + no fog when zoomed in (matches native pin math). */
export function configureEarthMap(map: MapboxMap) {
  const run = () => applyMapProjection(map)

  if (map.isStyleLoaded()) run()
  else map.once('style.load', run)

  map.on('zoom', run)
  map.on('zoomend', run)

  map.setMinZoom(2)
  map.setMaxZoom(18)
}
