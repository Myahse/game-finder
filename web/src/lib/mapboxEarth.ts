import type { Map as MapboxMap } from 'mapbox-gl'

/** Globe + atmosphere when zoomed out (Mapbox GL), aligned with mobile world view. */
export function configureEarthMap(map: MapboxMap) {
  const applyGlobe = () => {
    try {
      map.setProjection({ name: 'globe' })
    } catch {
      // ignore on unsupported builds
    }
    try {
      map.setFog({
        color: 'rgb(186, 210, 235)',
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.04,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.35,
      })
    } catch {
      // ignore
    }
  }

  if (map.isStyleLoaded()) applyGlobe()
  else map.once('style.load', applyGlobe)

  map.setMinZoom(2)
  map.setMaxZoom(18)
}
