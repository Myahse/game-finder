import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import type { Options } from '@dicebear/avataaars'
import type { PlayerAvatarConfig } from '../schema'
import { SKIN_PALETTE } from '../colors'
import { kitOf } from './kit'
import { HAIR_COLORS } from './palette'

/*
 * Player portraits use Avataaars by Pablo Stanley (https://avataaars.com — free for personal and
 * commercial use), bundled via DiceBear. Our saved config ids map onto its parts here; older ids
 * from the previous drawn style map to the closest look so saved avatars keep working.
 */

type Opts = Required<Options>
type Top = NonNullable<Opts['top']>[number]

const HAIR: Record<string, Top> = {
  hair_buzz: 'theCaesar',
  hair_short_flat: 'shortFlat',
  hair_short_round: 'shortRound',
  hair_side_part: 'theCaesarAndSidePart',
  hair_waves: 'shortWaved',
  hair_curls_short: 'shortCurly',
  hair_quiff: 'frizzle',
  hair_twists: 'dreads02',
  hair_locs: 'dreads01',
  hair_locs_long: 'dreads',
  hair_afro: 'fro',
  hair_puff: 'froBand',
  hair_curly: 'curly',
  hair_long_curly: 'curvy',
  hair_big: 'bigHair',
  hair_bun: 'bun',
  hair_braid_crown: 'frida',
  hair_bob: 'bob',
  hair_bob_bangs: 'miaWallace',
  hair_shaggy: 'shaggy',
  hair_mullet: 'shaggyMullet',
  hair_shaved_side: 'shavedSides',
  hair_long_wavy: 'longButNotTooLong',
  hair_long_straight: 'straight01',
  hair_long_sleek: 'straight02',
  hair_long_strand: 'straightAndStrand',
  hair_balding: 'sides',
  hair_headwrap: 'turban',
  hair_hijab: 'hijab',
  // legacy ids
  hair_fade_low: 'shortFlat',
  hair_fade_mid: 'shortRound',
  hair_fade_high: 'shortFlat',
  hair_crop: 'theCaesarAndSidePart',
  hair_wavy_med: 'shortWaved',
  hair_braids: 'dreads02',
  hair_ponytail: 'straight02',
  hair_box_braids: 'dreads',
  hair_cornrows: 'dreads01',
  hair_hightop: 'shortFlat',
  hair_mohawk: 'frizzle',
  hair_bantu_knots: 'frida',
  hair_pixie: 'shaggy',
}

const HEADWEAR: Record<string, Top> = {
  head_cap: 'hat',
  head_beanie: 'winterHat02',
  head_bobble: 'winterHat03',
  head_earflap: 'winterHat1',
  head_headband: 'winterHat02',
  head_bandana: 'winterHat04',
}

const EYES: Record<string, NonNullable<Opts['eyes']>[number]> = {
  eyes_01: 'default',
  eyes_02: 'squint',
  eyes_03: 'happy',
  eyes_04: 'side',
  eyes_05: 'surprised',
  eyes_wink: 'wink',
}

const BROWS: Record<string, NonNullable<Opts['eyebrows']>[number]> = {
  brow_curved: 'defaultNatural',
  brow_straight: 'flatNatural',
  brow_thick: 'default',
  brow_thin: 'raisedExcitedNatural',
  brow_athletic: 'angryNatural',
  brow_expressive: 'upDownNatural',
}

const MOUTHS: Record<string, NonNullable<Opts['mouth']>[number]> = {
  mouth_neutral: 'default',
  mouth_smile: 'twinkle',
  mouth_big_smile: 'smile',
  mouth_serious: 'serious',
  mouth_confident: 'tongue',
  mouth_relaxed: 'twinkle',
}

const BEARDS: Record<string, NonNullable<Opts['facialHair']>[number]> = {
  beard_stubble: 'beardLight',
  beard_short: 'beardMedium',
  beard_full: 'beardMajestic',
  beard_full_mustache: 'beardMajestic',
  beard_mustache: 'moustacheFancy',
  beard_goatee: 'moustacheMagnum',
}

const EYEWEAR: Record<string, NonNullable<Opts['accessories']>[number]> = {
  eye_glasses: 'prescription02',
  eye_round: 'round',
  eye_sport: 'wayfarers',
  eye_sunglasses: 'sunglasses',
}

const CLOTHING: Record<string, NonNullable<Opts['clothing']>[number]> = {
  top_basketball_jersey: 'shirtScoopNeck',
  top_tank: 'shirtScoopNeck',
  top_running_shirt: 'shirtScoopNeck',
  top_sports_bra: 'shirtScoopNeck',
  top_football_jersey: 'shirtVNeck',
  top_badminton_shirt: 'shirtVNeck',
  top_tennis_shirt: 'collarAndSweater',
  top_tee: 'shirtCrewNeck',
  top_compression: 'shirtCrewNeck',
  top_hoodie: 'hoodie',
}

/** Tops that carry a jersey number on the chest. */
const NUMBERED = new Set(['top_basketball_jersey', 'top_football_jersey', 'top_tank', 'top_badminton_shirt'])

const hex = (h: string) => h.replace('#', '')

/** Face override for stickers (eyes / brows / mouth in Avataaars' own names). */
export type Expression = {
  eyes?: Opts['eyes'][number]
  eyebrows?: Opts['eyebrows'][number]
  mouth?: Opts['mouth'][number]
}

/** SVG markup for a player's portrait (head and shoulders, 280×280 viewBox, transparent background). */
const EYES_TAG = '<g transform="translate(76 90)">'
let closedEyesMarkup: string | null = null

/** Inner markup of Avataaars' closed eyes (the same for every look), built once. */
function closedEyes(): string {
  if (closedEyesMarkup !== null) return closedEyesMarkup
  const svg = createAvatar(avataaars, { eyes: ['closed'] }).toString()
  closedEyesMarkup = innerOfGroup(svg, EYES_TAG)
  return closedEyesMarkup
}

/** The markup inside the first `<g …>` that starts with [openTag], nested groups included. */
export function innerOfGroup(svg: string, openTag: string): string {
  const start = svg.indexOf(openTag)
  if (start < 0) return ''
  let depth = 1
  let i = start + openTag.length
  const re = /<g[\s>]|<\/g>/g
  re.lastIndex = i
  for (let m = re.exec(svg); m; m = re.exec(svg)) {
    depth += m[0] === '</g>' ? -1 : 1
    if (depth === 0) return svg.slice(i, m.index)
  }
  return ''
}

export function avataaarsSvg(c: PlayerAvatarConfig, expression: Expression = {}): string {
  const kit = kitOf(c)
  const hair = HAIR_COLORS[c.hairColor] ?? HAIR_COLORS.black
  const skin = (SKIN_PALETTE[c.skinTone] ?? SKIN_PALETTE.skin_04).base
  const hat = c.headwear ? HEADWEAR[c.headwear] : undefined
  const beard = BEARDS[c.facialHair]
  const glasses = c.eyewear ? EYEWEAR[c.eyewear] : undefined
  const svg = createAvatar(avataaars, {
    top: [hat ?? HAIR[c.hair] ?? 'shortFlat'],
    topProbability: 100,
    hairColor: [hex(hair)],
    hatColor: [hex(kit.accent)],
    skinColor: [hex(skin)],
    eyes: [expression.eyes ?? EYES[c.eyes] ?? 'default'],
    eyebrows: [expression.eyebrows ?? BROWS[c.eyebrows] ?? 'defaultNatural'],
    mouth: [expression.mouth ?? MOUTHS[c.mouth] ?? 'smile'],
    facialHair: beard ? [beard] : undefined,
    facialHairProbability: beard ? 100 : 0,
    facialHairColor: [hex(hair)],
    accessories: glasses ? [glasses] : undefined,
    accessoriesProbability: glasses ? 100 : 0,
    accessoriesColor: ['262e33'],
    clothing: [CLOTHING[c.top] ?? 'shirtCrewNeck'],
    clothesColor: [hex(kit.main)],
  })
    .toString()
    // Live portraits blink by swapping to a hidden closed-eyes copy (opacity only, so
    // nothing moves). Avataaars always draws the eyes at this offset; outside the app's
    // CSS (canvas, stickers) the copy stays invisible.
    .replace(EYES_TAG, `<g class="ftg-av-eyes-closed" opacity="0" ${EYES_TAG.slice(3)}${closedEyes()}</g><g class="ftg-av-eyes" ${EYES_TAG.slice(3)}`)

  if (!NUMBERED.has(c.top) || !kit.number) return svg
  // Jersey number on the chest (ids/colours are ours, never user text, so this is safe markup).
  const number = `<text x="172" y="258" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-weight="800" font-size="22" fill="${kit.ink}" stroke="${kit.trim}" stroke-width="1.2" paint-order="stroke">${Number(kit.number) || kit.number.replace(/\D/g, '')}</text>`
  return svg.replace(/<\/svg>\s*$/, `${number}</svg>`)
}
