import type { Coords } from './location'
import { MAPBOX_ACCESS_TOKEN } from './mapbox'

export type GeocodeBias = {
  proximity: Coords
  /** ISO 3166-1 alpha-2 (Mapbox `country` param). */
  countryCode?: string
  city?: string
}

type MapboxContext = { id?: string; short_code?: string; text?: string }

let cacheKey = ''
let cacheBias: GeocodeBias | null = null

function parseContext(context: MapboxContext[] | undefined, coords: Coords): GeocodeBias {
  const bias: GeocodeBias = { proximity: coords }
  if (!context?.length) return bias
  for (const c of context) {
    const id = c.id ?? ''
    if (id.startsWith('country.') && c.short_code) {
      bias.countryCode = c.short_code.toLowerCase().split('-')[0]
    }
    if ((id.startsWith('place.') || id.startsWith('locality.') || id.startsWith('district.')) && c.text) {
      bias.city = c.text
    }
  }
  return bias
}

/** Resolve country / city from GPS so forward geocode prefers the user's area. */
export async function geocodeBiasFor(coords: Coords): Promise<GeocodeBias> {
  const key = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`
  if (cacheKey === key && cacheBias) return cacheBias

  const bias: GeocodeBias = { proximity: coords }
  const token = MAPBOX_ACCESS_TOKEN
  if (!token) {
    cacheKey = key
    cacheBias = bias
    return bias
  }

  const params = new URLSearchParams({
    access_token: token,
    limit: '1',
    types: 'place,locality,address',
  })
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.longitude},${coords.latitude}.json?${params}`
  try {
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as {
        features?: { context?: MapboxContext[]; place_type?: string[] }[]
      }
      const feature = data.features?.[0]
      if (feature?.context) {
        const parsed = parseContext(feature.context, coords)
        bias.countryCode = parsed.countryCode
        bias.city = parsed.city
      }
    }
  } catch {
    // proximity-only bias
  }

  cacheKey = key
  cacheBias = bias
  return bias
}
