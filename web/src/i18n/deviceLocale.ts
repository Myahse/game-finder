import type { Locale } from './messages'

/** Match Flutter: use the device / browser language (no in-app override). */
export function deviceLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of candidates) {
    const code = tag.toLowerCase().split('-')[0]
    if (code === 'fr') return 'fr'
    if (code === 'en') return 'en'
  }
  return 'en'
}
