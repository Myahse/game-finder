/** Stylized game skin tones — base + shadow (not saturated). */
export const SKIN_PALETTE: Record<string, { base: string; mid: string; shadow: string; highlight: string }> = {
  skin_01: { base: '#F4D8C6', mid: '#E8C4AD', shadow: '#CFA88E', highlight: '#FAE8DC' },
  skin_02: { base: '#EDD0B8', mid: '#DDB896', shadow: '#C49A76', highlight: '#F5E2D0' },
  skin_03: { base: '#E2BC96', mid: '#CFA37A', shadow: '#A67F58', highlight: '#EFD4B8' },
  skin_04: { base: '#C99563', mid: '#B07D4E', shadow: '#8A5F3A', highlight: '#DDB088' },
  skin_05: { base: '#A67A4E', mid: '#8F653F', shadow: '#6B4A2C', highlight: '#C49A6E' },
  skin_06: { base: '#8B5E3C', mid: '#744D32', shadow: '#553820', highlight: '#A67D58' },
  skin_07: { base: '#6E4528', mid: '#5A3820', shadow: '#3F2716', highlight: '#8B6240' },
  skin_08: { base: '#4F321C', mid: '#3F2816', shadow: '#2A1A0F', highlight: '#6B4530' },
  skin_09: { base: '#D9A574', mid: '#C48E5C', shadow: '#9E6D42', highlight: '#E8BF94' },
  skin_10: { base: '#B8895A', mid: '#9E7248', shadow: '#785636', highlight: '#D4A67A' },
  skin_11: { base: '#9A6B47', mid: '#825839', shadow: '#614228', highlight: '#B88760' },
  skin_12: { base: '#7A5235', mid: '#644329', shadow: '#4A301E', highlight: '#9A6F4E' },
}

export const SKIN_HEX: Record<string, string> = Object.fromEntries(
  Object.entries(SKIN_PALETTE).map(([k, v]) => [k, v.base]),
)

export function skinColors(id: string) {
  return SKIN_PALETTE[id] ?? SKIN_PALETTE.skin_04
}

export const HAIR_HEX: Record<string, string> = {
  black: '#14100c',
  dark_brown: '#2a1c10',
  brown: '#3d2814',
  light_brown: '#5c4024',
  blonde: '#c9a05a',
  platinum: '#d8d4cc',
  red: '#6b3024',
  grey: '#5a5a5a',
}

export const JERSEY_BY_TOP: Record<string, { fill: string; trim: string; accent: string }> = {
  top_basketball_jersey: { fill: '#c1121f', trim: '#780000', accent: '#f4a261' },
  top_football_jersey: { fill: '#1b4332', trim: '#081c15', accent: '#d8f3dc' },
  top_tennis_shirt: { fill: '#f8f9fa', trim: '#ced4da', accent: '#2d6a4f' },
  top_badminton_shirt: { fill: '#0077b6', trim: '#023e8a', accent: '#90e0ef' },
  top_running_shirt: { fill: '#e85d04', trim: '#9d3800', accent: '#ffba08' },
  top_compression: { fill: '#212529', trim: '#000', accent: '#495057' },
  top_hoodie: { fill: '#343a40', trim: '#212529', accent: '#adb5bd' },
  top_tank: { fill: '#1864ab', trim: '#0b3d91', accent: '#74c0fc' },
  top_tee: { fill: '#6c757d', trim: '#495057', accent: '#dee2e6' },
}

export const SHORTS_COLOR = { fill: '#1d1d2e', shadow: '#12121c', trim: '#2b2b40' }
