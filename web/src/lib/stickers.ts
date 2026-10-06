import type { PlayerAvatarConfig, SportSlug } from '../avatar/schema'
import { avataaarsSvg, type Expression } from '../avatar/render/avataaars'
import { kitOf } from '../avatar/render/kit'

/** WhatsApp sticker size. */
const SIZE = 512

export type StickerSpec = { id: string; caption: string; expression: Expression; tilt: number }

const SPORT_CHEER: Partial<Record<SportSlug, { en: string; fr: string }>> = {
  basketball: { en: 'BUCKETS!', fr: 'PANIER !' },
  football: { en: 'GOAL!', fr: 'BUT !' },
  volleyball: { en: 'ACE!', fr: 'ACE !' },
  tennis: { en: 'ACE!', fr: 'ACE !' },
  badminton: { en: 'SMASH!', fr: 'SMASH !' },
}

/** The sticker set: everyday pickup-game reactions plus a cheer for the player's sport. */
export function stickerSet(sport: SportSlug, locale: 'en' | 'fr'): StickerSpec[] {
  const fr = locale === 'fr'
  const cheer = SPORT_CHEER[sport] ?? { en: "LET'S GO!", fr: 'ALLEZ !' }
  return [
    { id: 'got-next', caption: fr ? 'JE PRENDS LA SUITE' : 'GOT NEXT?', expression: { eyes: 'default', eyebrows: 'raisedExcitedNatural', mouth: 'smile' }, tilt: -4 },
    { id: 'on-my-way', caption: fr ? "J'ARRIVE" : 'ON MY WAY', expression: { eyes: 'happy', eyebrows: 'defaultNatural', mouth: 'twinkle' }, tilt: 3 },
    { id: 'cheer', caption: fr ? cheer.fr : cheer.en, expression: { eyes: 'surprised', eyebrows: 'raisedExcited', mouth: 'screamOpen' }, tilt: -6 },
    { id: 'gg', caption: 'GG', expression: { eyes: 'wink', eyebrows: 'defaultNatural', mouth: 'twinkle' }, tilt: 5 },
    { id: 'whos-in', caption: fr ? 'QUI JOUE ?' : "WHO'S IN?", expression: { eyes: 'side', eyebrows: 'upDownNatural', mouth: 'default' }, tilt: -3 },
    { id: 'lets-go', caption: fr ? 'ALLEZ !' : "LET'S GO!", expression: { eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile' }, tilt: 4 },
    { id: 'rain-check', caption: fr ? 'PAS AUJOURD’HUI' : 'RAIN CHECK', expression: { eyes: 'default', eyebrows: 'sadConcernedNatural', mouth: 'concerned' }, tilt: -2 },
    { id: 'rematch', caption: fr ? 'REVANCHE ?' : 'REMATCH?', expression: { eyes: 'squint', eyebrows: 'angryNatural', mouth: 'serious' }, tilt: 3 },
  ]
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/**
 * One sticker as a transparent 512×512 PNG: the avatar with a white die-cut border
 * and a bold caption in the player's kit colours.
 */
export async function renderSticker(config: PlayerAvatarConfig, spec: StickerSpec): Promise<Blob> {
  const kit = kitOf(config)
  const font = (px: number) => `800 ${px}px "Barlow Condensed", "Arial Narrow", Impact, sans-serif`
  try {
    await document.fonts.load(font(96))
  } catch {
    // system font fallback
  }
  const img = await loadSvg(avataaarsSvg(config, spec.expression))

  // Avatar on its own layer, then a white silhouette of it for the die-cut outline.
  const art = document.createElement('canvas')
  art.width = art.height = SIZE
  const a = art.getContext('2d')!
  const size = 400
  const ax = (SIZE - size) / 2
  const ay = 8
  a.drawImage(img, ax, ay, size, size)
  const outline = document.createElement('canvas')
  outline.width = outline.height = SIZE
  const o = outline.getContext('2d')!
  const border = 12
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2
    o.drawImage(art, Math.cos(ang) * border, Math.sin(ang) * border)
  }
  o.globalCompositeOperation = 'source-in'
  o.fillStyle = '#ffffff'
  o.fillRect(0, 0, SIZE, SIZE)

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.22)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4
  ctx.drawImage(outline, 0, 0)
  ctx.restore()
  ctx.drawImage(art, 0, 0)

  // Caption: slight tilt, thick white stroke, kit-coloured fill.
  ctx.save()
  ctx.translate(SIZE / 2, SIZE - 70)
  ctx.rotate((spec.tilt * Math.PI) / 180)
  let px = 104
  ctx.font = font(px)
  while (ctx.measureText(spec.caption).width > SIZE - 56 && px > 48) {
    px -= 4
    ctx.font = font(px)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 22
  ctx.strokeStyle = '#ffffff'
  ctx.strokeText(spec.caption, 0, 0)
  ctx.lineWidth = 6
  ctx.strokeStyle = '#12151a'
  ctx.strokeText(spec.caption, 0, 0)
  ctx.fillStyle = kit.accent
  ctx.fillText(spec.caption, 0, 0)
  ctx.restore()

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'))
}
