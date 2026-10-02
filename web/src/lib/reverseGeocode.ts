import type { Coords } from './location'
import { MAPBOX_ACCESS_TOKEN } from './mapbox'

/** Mapbox reverse geocode — returns a human-readable place name for map coordinates. */
export async function reverseGeocode(coords: Coords): Promise<string | null> {
  const token = MAPBOX_ACCESS_TOKEN
  if (!token) return null
  const { longitude, latitude } = coords
  const params = new URLSearchParams({
    access_token: token,
    limit: '1',
    types: 'address,poi,place,locality,neighborhood',
  })
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { features?: { place_name?: string }[] }
    const name = data.features?.[0]?.place_name?.trim()
    return name || null
  } catch {
    return null
  }
}
