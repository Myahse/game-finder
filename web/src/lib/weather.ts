import { useQuery } from '@tanstack/react-query'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from 'lucide-react'
import { api } from './api'

export type WeatherHour = { t: number; temp: number; rain_pct: number; precip_mm: number; code: number; wind_kmh: number }
export type Forecast = { hours: WeatherHour[] }

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'storm'

/** Rain chance (%) from which we flag a rain check. */
export const RAIN_CHECK_PCT = 50
/** A slot counts as "drier" under this rain chance. */
const DRY_PCT = 30

export function useCourtWeather(courtId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['weather', courtId],
    queryFn: () => api<Forecast>(`/api/courts/${courtId}/weather`),
    enabled: !!courtId && enabled,
    staleTime: 20 * 60_000,
    retry: 1,
  })
}

/** WMO weather code → our coarse kind. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 71 && code <= 77)) return 'rain'
  if (code >= 80 && code <= 86) return 'showers'
  if (code >= 95) return 'storm'
  return 'cloudy'
}

export const weatherIcons: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  showers: CloudRain,
  storm: CloudLightning,
}

const HOUR = 3600

/** Forecast hours overlapping [start, start + minutes). */
export function hoursFor(f: Forecast | undefined, start: Date, minutes: number): WeatherHour[] {
  if (!f) return []
  const from = Math.floor(start.getTime() / 1000 / HOUR) * HOUR
  const to = start.getTime() / 1000 + minutes * 60
  return f.hours.filter((h) => h.t >= from && h.t < to)
}

/** The forecast hour closest to `at`, if the forecast covers it. */
export function hourAt(f: Forecast | undefined, at: Date): WeatherHour | null {
  if (!f || f.hours.length === 0) return null
  const s = at.getTime() / 1000
  const first = f.hours[0].t
  const last = f.hours[f.hours.length - 1].t
  if (s < first - HOUR || s > last + HOUR) return null
  return f.hours.reduce((best, h) => (Math.abs(h.t - s) < Math.abs(best.t - s) ? h : best))
}

export function worstRain(hours: WeatherHour[]): number {
  return hours.reduce((m, h) => Math.max(m, h.rain_pct), 0)
}

export function isRainy(hours: WeatherHour[]): boolean {
  return hours.some((h) => h.rain_pct >= RAIN_CHECK_PCT || h.precip_mm >= 1 || weatherKind(h.code) === 'storm')
}

/**
 * Nearest start time (on the hour, within -3h…+6h of the original, at least 30 min from now)
 * whose whole game window stays dry.
 */
export function drierSlot(f: Forecast | undefined, start: Date, minutes: number, now = new Date()): { at: Date; rain: number } | null {
  if (!f) return null
  const base = Math.round(start.getTime() / 1000 / HOUR) * HOUR
  const candidates: number[] = []
  for (let d = 1; d <= 6; d++) candidates.push(base + d * HOUR, base - d * HOUR)
  for (const c of candidates) {
    const at = new Date(c * 1000)
    if (c - now.getTime() / 1000 < 30 * 60 || c < base - 3 * HOUR) continue
    const window = hoursFor(f, at, minutes)
    if (window.length === 0 || window.length < Math.ceil(minutes / 60)) continue
    const rain = worstRain(window)
    if (rain < DRY_PCT && !isRainy(window)) return { at, rain }
  }
  return null
}
