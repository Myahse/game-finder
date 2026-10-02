import { useSearchParams } from 'react-router-dom'
import { useAuth } from './auth'
import { useSports } from './queries'
import type { Sport } from './types'

/** Signed-in user's single chosen sport (from onboarding). */
export function useMySport(): Sport | null {
  const { user } = useAuth()
  const { data: sports } = useSports()
  if (!user?.preferred_sport_id || !sports) return null
  return sports.find((s) => s.id === user.preferred_sport_id) ?? null
}

/** Sport slug for map / nearby lists. Admins may use the URL filter; everyone else is locked to their sport. */
export function useBrowseSportSlug(): string | null {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const mySport = useMySport()
  if (user?.role === 'admin') return params.get('sport')
  return mySport?.slug ?? null
}
