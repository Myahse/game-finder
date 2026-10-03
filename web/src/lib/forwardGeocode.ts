import { distanceM } from './format'
import type { GeocodeBias } from './geocodeBias'
import { MAPBOX_ACCESS_TOKEN } from './mapbox'

export type GeocodeFeature = {
  id: string
  place_name: string
  center: [number, number]
}

function rankFeatures(features: GeocodeFeature[], bias?: GeocodeBias): GeocodeFeature[] {
  if (!bias?.proximity) return features
  const city = bias.city?.toLowerCase()
  const scored = features.map((f) => {
    const dist = distanceM(bias.proximity.latitude, bias.proximity.longitude, f.center[1], f.center[0])
    const inCity = city && f.place_name.toLowerCase().includes(city) ? 0 : 1
    return { f, inCity, dist }
  })
  scored.sort((a, b) => a.inCity - b.inCity || a.dist - b.dist)
  return scored.map((s) => s.f)
}

/** Mapbox forward geocode — biased to user proximity, country, and city when known. */
export async function forwardGeocode(query: string, bias?: GeocodeBias): Promise<GeocodeFeature[]> {
  const token = MAPBOX_ACCESS_TOKEN
  const q = query.trim()
  if (!token || q.length < 2) return []
  const params = new URLSearchParams({
    access_token: token,
    limit: '8',
    autocomplete: 'true',
    types: 'address,poi,place,locality,neighborhood',
  })
  if (bias?.proximity) {
    params.set('proximity', `${bias.proximity.longitude},${bias.proximity.latitude}`)
  }
  if (bias?.countryCode) {
    params.set('country', bias.countryCode)
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { features?: { id: string; place_name: string; center: [number, number] }[] }
    const features = (data.features ?? []).map((f) => ({
      id: f.id,
      place_name: f.place_name,
      center: f.center,
    }))
    return rankFeatures(features, bias).slice(0, 6)
  } catch {
    return []
  }
}
