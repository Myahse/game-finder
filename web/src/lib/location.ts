import { useEffect, useState } from 'react'

export interface Coords {
  latitude: number
  longitude: number
}

// Grand-Bassam: where the first community launches. Used until we know better.
export const DEFAULT_CENTER: Coords = { latitude: 5.2118, longitude: -3.7389 }

export type LocationStatus = 'pending' | 'granted' | 'denied' | 'unavailable'

/**
 * Watches the device position. Precise coordinates stay on the device except
 * when sent for distance sorting or an "I'm here" check-in.
 */
export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<LocationStatus>(() =>
    typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'pending' : 'unavailable',
  )

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStatus('granted')
        setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude })
      },
      () => {},
      // Fresh fix on load — iOS Safari often serves a coarse cached point first.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setStatus('granted')
        setCoords((prev) => {
          const next = { latitude: p.coords.latitude, longitude: p.coords.longitude }
          // Ignore jitter under ~10 m so queries don't refetch constantly.
          if (prev && Math.abs(prev.latitude - next.latitude) < 1e-4 && Math.abs(prev.longitude - next.longitude) < 1e-4)
            return prev
          return next
        })
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const center = coords ?? DEFAULT_CENTER
  const waitingGps = status === 'pending' && coords === null

  return { coords, status, center, waitingGps, hasFix: coords !== null }
}

/** Rounded to ~1 km for cache keys and "near you" alerts. */
export function coarse(c: Coords) {
  return { lat: Math.round(c.latitude * 100) / 100, lng: Math.round(c.longitude * 100) / 100 }
}
