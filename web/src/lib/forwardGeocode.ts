import type { Coords } from './location'
import { MAPBOX_ACCESS_TOKEN } from './mapbox'

export type GeocodeFeature = {
  id: string
  place_name: string
  center: [number, number]
}

/** Mapbox forward geocode — search places near optional proximity. */
export async function forwardGeocode(query: string, proximity?: Coords): Promise<GeocodeFeature[]> {
  const token = MAPBOX_ACCESS_TOKEN
  const q = query.trim()
  if (!token || q.length < 2) return []
  const params = new URLSearchParams({
    access_token: token,
    limit: '6',
    autocomplete: 'true',
    types: 'address,poi,place,locality,neighborhood',
  })
  if (proximity) params.set('proximity', `${proximity.longitude},${proximity.latitude}`)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { features?: { id: string; place_name: string; center: [number, number] }[] }
    return (data.features ?? []).map((f) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
    }))
  } catch {
    return []
  }
}
