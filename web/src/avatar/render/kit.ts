import type { PlayerAvatarConfig } from '../schema'
import { KIT_COLORS } from '../registry'
import { KITS, luminance } from './palette'

const hexOf = (id: string | null | undefined) => KIT_COLORS.find((k) => k.id === id)?.hex

/** Resolved team kit: the player's chosen colours, else their sport's. */
export function kitOf(c: PlayerAvatarConfig) {
  const sport = KITS[c.sport] ?? KITS.basketball
  const main = hexOf(c.kitMain) ?? sport.main
  const trim = hexOf(c.kitTrim) ?? sport.trim
  const custom = !!(c.kitMain || c.kitTrim)
  const light = luminance(main) > 0.62
  // Numbers need contrast with the shirt: use the trim when it reads, else ink/white.
  const ink = custom ? (Math.abs(luminance(trim) - luminance(main)) > 0.35 ? trim : light ? '#1d1f2b' : '#ffffff') : sport.ink
  const number = c.number != null ? String(c.number) : sport.number
  /** A colour that shows up on light backgrounds (white kits fall back to the trim). */
  const accent = light ? trim : main
  return { main, trim, ink, number, accent }
}

