import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useSports } from './queries'
import type { Sport } from './types'

/** Primary sport from onboarding (locked after signup for non-admins). */
export function useMySport(): Sport | null {
  const sports = useMySports()
  return sports[0] ?? null
}

/** Primary + up to 2 extra sports on the user's profile. */
export function useMySports(): Sport[] {
  const { user } = useAuth()
  const { data: sports } = useSports()
  if (!user || !sports) return []
  const ids = [user.preferred_sport_id, ...(user.extra_sport_ids ?? [])].filter(Boolean) as string[]
  const out: Sport[] = []
  for (const id of ids) {
    const s = sports.find((x) => x.id === id)
    if (s) out.push(s)
  }
  return out
}

/** Sport slug for map / nearby lists. Admins use URL filter; members filter among their sports. */
export function useBrowseSportSlug(): string | null {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const mySports = useMySports()
  const allowed = new Set(mySports.map((s) => s.slug))
  if (user?.role === 'admin') return params.get('sport')
  const param = params.get('sport')
  if (param && allowed.has(param)) return param
  return mySports[0]?.slug ?? null
}
