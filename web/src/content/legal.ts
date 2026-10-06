/** Plain-language terms & privacy for signup (not legal advice — customize before wide launch).
 * The text lives in i18n/screens/legal.ts (EN + FR); these helpers return it for the device language. */
import { currentT } from '../i18n/LocaleProvider'

export type LegalSection = { title: string; body: string }

export function legalLastUpdated(): string {
  return currentT().legal.lastUpdated
}

export function termsSections(): LegalSection[] {
  return currentT().legal.terms
}

export function privacySections(): LegalSection[] {
  return currentT().legal.privacy
}
