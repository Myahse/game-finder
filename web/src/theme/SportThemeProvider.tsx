import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMySport } from '../lib/mySport'

/** Sports with a dedicated skin in `index.css` (`[data-sport=…]`). Anything else falls back to the default (basketball) palette. */
export const themedSports = ['basketball', 'football', 'volleyball', 'tennis', 'badminton'] as const
export type ThemedSport = (typeof themedSports)[number]

export function isThemedSport(slug: string | null | undefined): slug is ThemedSport {
  return !!slug && (themedSports as readonly string[]).includes(slug)
}

/** Read by `public/theme-boot.js` so a returning user never flashes the default colours. */
const STORAGE_KEY = 'ftg.sport'

type SportThemeValue = {
  /** Base sport skin currently applied to the app (preview wins over the saved profile). */
  slug: ThemedSport | null
  setPreview: (slug: string | null) => void
}

const SportThemeContext = createContext<SportThemeValue>({ slug: null, setPreview: () => {} })

function applyDocumentSport(slug: ThemedSport | null) {
  const root = document.documentElement
  if (slug) root.dataset.sport = slug
  else delete root.dataset.sport
  try {
    if (slug) localStorage.setItem(STORAGE_KEY, slug)
  } catch {
    // Storage blocked (private mode) — the skin still applies for this visit.
  }
}

/**
 * The whole app wears the user's *base* (primary) sport: brand colour, accents and
 * the sport icon in nav / empty states. Extra sports only add map filters — they never
 * change the skin. Onboarding can preview a sport before it is saved.
 */
export function SportThemeProvider({ children }: { children: ReactNode }) {
  const mySport = useMySport()
  const [preview, setPreview] = useState<string | null>(null)
  const candidate = preview ?? mySport?.slug ?? null
  const slug = isThemedSport(candidate) ? candidate : null

  useEffect(() => {
    // Logged out / still loading: keep whatever the boot script restored.
    if (!slug && !preview && !mySport) return
    applyDocumentSport(slug)
  }, [slug, preview, mySport])

  const value = useMemo(() => ({ slug, setPreview }), [slug])
  return <SportThemeContext.Provider value={value}>{children}</SportThemeContext.Provider>
}

export function useSportTheme() {
  return useContext(SportThemeContext).slug
}

/** Live-preview a base sport skin while the calling component is mounted (onboarding). */
export function useSportThemePreview(slug: string | null) {
  const { setPreview } = useContext(SportThemeContext)
  useEffect(() => {
    setPreview(slug)
  }, [slug, setPreview])
  useEffect(() => () => setPreview(null), [setPreview])
}
