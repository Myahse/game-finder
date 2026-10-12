// The words of one sport in Mode Jeu: basketball's feed, banners and
// attribute names, with each other sport's own words on top.
import type { MessageTree as Messages } from '../i18n/messages'
import { ATTR_KEYS, SPORTS, type AttrKey, type Sport } from './engine'

export const isNet = (s: Sport) => s === 'volleyball' || s === 'tennis' || s === 'badminton'

export function sportWords(t: Messages, sport: Sport) {
  const j = t.jeu
  const attrOver = j.sportAttr[sport] ?? {}
  const attr = Object.fromEntries(ATTR_KEYS.map((k) => [k, (attrOver as Record<string, string>)[k] ?? j.avatar.attr[k]])) as Record<AttrKey, string>
  return {
    name: j.sports[sport] ?? sport,
    rule: j.rules[sport] ?? '',
    feed: { ...(j.feed as Record<string, string>), ...(j.sportFeed[sport] ?? {}) },
    banner: { ...(j.banner as Record<string, string>), ...(j.sportBanner[sport] ?? {}) },
    moment: { ...(j.moment as Record<string, string>), ...(j.sportMoment[sport === 'football' ? 'football' : isNet(sport) ? 'net' : ''] ?? {}) },
    attr,
  }
}

/** The 3 or 4 numbers shown under a player during and after a match: [stat field, label]. */
export function statCols(t: Messages, sport: Sport): ['pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm' | 'fgm' | 'to', string][] {
  const s = t.jeu.stat
  switch (sport) {
    case 'football': return [['pts', s.goals], ['ast', s.ast], ['stl', s.stl], ['blk', s.blk]]
    case 'volleyball': return [['pts', s.pts], ['tpm', s.aces], ['blk', s.blk], ['reb', s.digs]]
    case 'tennis': return [['pts', s.pts], ['tpm', s.aces], ['fgm', s.winners], ['to', s.errors]]
    case 'badminton': return [['pts', s.pts], ['tpm', s.smashes], ['fgm', s.winners], ['to', s.errors]]
    default: return [['pts', s.pts], ['reb', s.reb], ['ast', s.ast], ['blk', s.blk]]
  }
}

/** A court with at least one sport Mode Jeu plays. */
export const hasJeuSport = (c: { sports?: { slug: string }[] }) => !!c.sports?.some((x) => SPORTS.includes(x.slug as Sport))
/** The court's first Mode Jeu sport (its icon on the game map). */
export const jeuSportOf = (c: { sports?: { slug: string }[] }): Sport => (c.sports?.map((x) => x.slug).find((x) => SPORTS.includes(x as Sport)) as Sport | undefined) ?? 'basketball'
