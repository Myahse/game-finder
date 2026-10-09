import QRCode from 'qrcode'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { avataaarsSvg } from '../avatar/render/avataaars'
import { kitOf } from '../avatar/render/kit'
import type { en as cardMessages } from '../i18n/screens/card'
import { formatEloDelta, formatSerial, tierColor, type CardStyle, type PlayerCard } from './playerCard'
import { BOARD_PIN, CROWN, DH, DOMAIN, DW, INK, MUTED, PASS_PIN, PIN, POSTER_PIN, base, display, fillLabel, fitSize, interBase, recordLayout, sans } from './playerCardLayout'

/*
 * Player cards, drawn from the approved 405×720 designs (Trading card, Street poster,
 * Scoreboard, Court pass) at ×(1080/405) so the export is a 1080×1920 story image.
 * All coordinates below are in design pixels; y values passed to `text` are baselines.
 */
export const CARD_W = 1080
export const CARD_H = 1920

export type PlayerCardImageInput = {
  card: PlayerCard
  style: CardStyle
  /** Name lines (first / last, or the username), uppercase. */
  names: string[]
  avatar: PlayerAvatarConfig | null
  /** Uploaded profile photo, used when there is no player avatar. */
  photoUrl: string | null
  /** Markup of the sport's icon (24×24, currentColor). */
  sportIconSvg: string | null
  profileUrl: string
  labels: typeof cardMessages
}

type Art = { img: HTMLImageElement; photo: boolean } | null
type Ctx = CanvasRenderingContext2D
type TextOpts = { align?: CanvasTextAlign; spacing?: number; maxW?: number; stroke?: number }

function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const svgImage = (svg: string) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)

function setSpacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/** Font size (≤ `px`) at which `s` fits `maxW`; below `min`, `text`'s maxW squeezes it. */
function fit(ctx: Ctx, s: string, font: (px: number) => string, px: number, maxW: number, min = 8, spacing = 0) {
  return fitSize((p) => measure(ctx, s, font(p), spacing), px, maxW, min)
}

function measure(ctx: Ctx, s: string, font: string, spacing = 0) {
  ctx.font = font
  setSpacing(ctx, spacing)
  const w = ctx.measureText(s).width
  setSpacing(ctx, 0)
  return w
}

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, o: TextOpts = {}) {
  ctx.font = font
  setSpacing(ctx, o.spacing ?? 0)
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  if (o.stroke) {
    ctx.lineWidth = o.stroke
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.strokeText(s, x, y, o.maxW)
  } else {
    ctx.fillStyle = color
    ctx.fillText(s, x, y, o.maxW)
  }
  setSpacing(ctx, 0)
}

function poly(ctx: Ctx, x: number, y: number, pts: [number, number][]) {
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)))
  ctx.closePath()
}

/** The card outline: clipped top corners, pointed bottom. */
function shield(ctx: Ctx, x: number, y: number, w: number, h: number, corner: number, tip: number) {
  poly(ctx, x, y, [[corner, 0], [w - corner, 0], [w, corner], [w, h - tip], [w / 2, h], [0, h - tip], [0, corner]])
}

function path(d: string, x: number, y: number, sx: number, sy = sx) {
  const p = new Path2D()
  p.addPath(new Path2D(d), new DOMMatrix([sx, 0, 0, sy, x, y]))
  return p
}


/** The location pin of the logo (64×70 artwork) at width `w`. */
function logoPin(ctx: Ctx, cx: number, top: number, w: number, frame: string, hole: string) {
  const s = w / 64
  ctx.fillStyle = frame
  ctx.fill(path(PIN, cx - w / 2, top, s))
  ctx.beginPath()
  ctx.arc(cx, top + 25 * s, 10 * s, 0, Math.PI * 2)
  ctx.lineWidth = 3 * s
  ctx.strokeStyle = hole
  ctx.stroke()
}

/** Player portrait (head and shoulders) standing on `bottom`, `size` wide. */
function bust(ctx: Ctx, art: Art, cx: number, bottom: number, size: number, accent: string) {
  if (art && !art.photo) {
    ctx.drawImage(art.img, cx - size / 2, bottom - size, size, size)
    return
  }
  const r = size * 0.2
  const hy = bottom - size * 0.62
  ctx.beginPath()
  ctx.ellipse(cx, bottom, size * 0.42, size * 0.3, 0, Math.PI, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.15, bottom - size * 0.27)
  ctx.lineTo(cx, bottom - size * 0.15)
  ctx.lineTo(cx + size * 0.15, bottom - size * 0.27)
  ctx.lineWidth = size * 0.03
  ctx.strokeStyle = accent
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, hy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#8a5a3c'
  ctx.fill()
  if (art) {
    ctx.clip()
    const s = Math.min(art.img.width, art.img.height)
    ctx.drawImage(art.img, (art.img.width - s) / 2, (art.img.height - s) / 2, s, s, cx - r, hy - r, r * 2, r * 2)
  }
  ctx.restore()
}

/** Outlined jersey number, right-aligned at `right`. */
function jersey(ctx: Ctx, n: string | null, right: number, y: number, px: number, color: string, alpha: number) {
  if (!n) return
  ctx.save()
  ctx.globalAlpha = alpha
  text(ctx, n, right, y, display(px), color, { align: 'right', stroke: 2 })
  ctx.restore()
}

function brand(ctx: Ctx, x: number, y: number, px: number, weight: number) {
  text(ctx, 'OUT FOR ', x, y, display(px, weight), '#ffffff', { spacing: weight === 800 ? 0.5 : 0 })
  const w = measure(ctx, 'OUT FOR ', display(px, weight), weight === 800 ? 0.5 : 0)
  text(ctx, 'GROUND', x + w, y, display(px, weight), '#ff5a1f', { spacing: weight === 800 ? 0.5 : 0 })
}

type Ready = PlayerCardImageInput & { frame: string; tier: string; sport: string; serial: string; number: string | null; art: Art; icon: HTMLImageElement | null }

const fill = fillLabel

// ---------------------------------------------------------------------------
// 1 · Trading card
// ---------------------------------------------------------------------------
function drawTradingCard(ctx: Ctx, c: Ready) {
  const { card, labels: L, frame } = c
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, DW, DH)
  brand(ctx, 22, 45, 19, 800)
  text(ctx, `${c.tier} · ${L.season}`, 383, 41.4, sans(11), frame, { align: 'right', spacing: 2 })

  // The 610px card shrinks to the space left in the 720px column (as in the design).
  const ch = 605.5
  shield(ctx, 22, 62.8, 361, ch, 30, 92)
  ctx.fillStyle = frame
  ctx.fill()
  const ox = 27
  const oy = 67.8
  const ih = ch - 10
  ctx.save()
  shield(ctx, ox, oy, 351, ih, 27, 90)
  ctx.fillStyle = '#161a20'
  ctx.fill()
  ctx.clip()
  ctx.translate(ox, oy)

  // Court lines
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = frame
  ctx.lineWidth = 3
  for (const r of [230, 150]) {
    ctx.beginPath()
    ctx.arc(175, -20, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(115, 0)
  ctx.lineTo(115, 150)
  ctx.lineTo(235, 150)
  ctx.lineTo(235, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(175, 150, 60, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  jersey(ctx, c.number, 365, base(64, 230, 0.8), 230, frame, 0.35)
  bust(ctx, c.art, 218, 302, 262, frame)

  // Rating column
  const rating = String(card.rating)
  const sportW = Math.min(measure(ctx, c.sport, display(17, 800), 1.5), 92)
  const colW = Math.max(measure(ctx, rating, display(84)), sportW, 34, measure(ctx, fill(L.level, { n: card.level }), sans(11), 1))
  const cx = 22 + colW / 2
  text(ctx, rating, cx, base(22, 84, 0.82), display(84), frame, { align: 'center' })
  const sportPx = fit(ctx, c.sport, (px) => display(px, 800), 17, 92, 8, 1.5)
  text(ctx, c.sport, cx, 94.9 + sportPx, display(sportPx, 800), '#ffffff', { align: 'center', spacing: 1.5, maxW: 92 })
  ctx.fillStyle = frame
  ctx.fillRect(cx - 17, 119.3, 34, 2)
  if (c.icon) ctx.drawImage(c.icon, cx - 15, 125.3, 30, 30)
  text(ctx, fill(L.level, { n: card.level }), cx, interBase(161.3, 11), sans(11), MUTED, { align: 'center', spacing: 1 })

  // Name band (skewed −4°, text upright)
  const k = Math.tan((4 * Math.PI) / 180) * 175.5
  poly(ctx, 0, 300, [[0, k], [351, -k], [351, 58 - k], [0, 58 + k]])
  ctx.fillStyle = frame
  ctx.fill()
  const name = c.names.join(' ')
  const namePx = fit(ctx, name, (px) => display(px), 44, 321, 20)
  text(ctx, name, 175.5, 308 + (44 - namePx) / 2 + namePx * 0.9, display(namePx), INK, { align: 'center', spacing: 1, maxW: 321 })

  const where = [`@${card.user.username}`, card.home_court?.name].filter(Boolean).join(' · ')
  const wherePx = fit(ctx, where, (px) => sans(px, 700), 12, 321, 8, 0.5)
  text(ctx, where, 175.5, interBase(372, 12), sans(wherePx, 700), MUTED, { align: 'center', spacing: 0.5, maxW: 321 })

  // Stats
  const stats: [string, string][] = [
    [String(card.games), L.games],
    [String(card.win_pct), L.winPct],
    [String(card.win_streak), L.streak],
    [String(card.challenges_won), L.duels],
    [String(card.courts), L.courts],
    [String(card.elo), L.elo],
  ]
  const rows = [402, 446.6, 491.2]
  stats.forEach(([v, label], i) => {
    const x = 26 + (i % 2) * (138.5 + 22)
    const top = rows[Math.floor(i / 2)]
    const y = top + 28
    text(ctx, v, x, y, display(28), '#ffffff')
    const vw = Math.max(50, measure(ctx, v, display(28)))
    text(ctx, label, x + vw + 8, y, sans(12), MUTED, { spacing: 1.5, maxW: 138.5 - vw - 8 })
    if (i < 4) {
      ctx.fillStyle = '#2b313b'
      ctx.fillRect(x, top + 37.6, 138.5, 1)
    }
  })

  logoPin(ctx, 175.5, ih - 80.1, 26, frame, '#161a20')
  text(ctx, fill(L.serial, { n: c.serial }), 175.5, interBase(ih - 46.1, 10), sans(10), '#8b939e', { align: 'center', spacing: 2 })
  ctx.restore()

  // Copy line
  const lead = L.challengeMe
  const lw = measure(ctx, lead, sans(13, 700))
  const dw = measure(ctx, DOMAIN, sans(13, 700))
  const sx = DW / 2 - (lw + dw) / 2
  text(ctx, lead, sx, interBase(62.8 + ch + 14, 13), sans(13, 700), MUTED)
  text(ctx, DOMAIN, sx + lw, interBase(62.8 + ch + 14, 13), sans(13, 700), '#ffffff')
}

// ---------------------------------------------------------------------------
// 2 · Street poster
// ---------------------------------------------------------------------------
function drawPoster(ctx: Ctx, c: Ready) {
  const { card, labels: L, frame } = c
  ctx.fillStyle = frame
  ctx.fillRect(0, 0, DW, DH)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  for (const r of [300, 200]) {
    ctx.beginPath()
    ctx.arc(202, 740, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(132, 720)
  ctx.lineTo(132, 520)
  ctx.lineTo(272, 520)
  ctx.lineTo(272, 720)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(202, 520, 70, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  text(ctx, 'OUT FOR GROUND', 22, 42, display(20), INK)
  const pill = `${c.tier} · ${fill(L.serial, { n: c.serial })}`
  const pw = measure(ctx, pill, sans(11), 1.5) + 22
  ctx.beginPath()
  ctx.roundRect(383 - pw, 22.35, pw, 23.3, 12)
  ctx.fillStyle = INK
  ctx.fill()
  text(ctx, pill, 383 - pw + 11, 38, sans(11), frame, { spacing: 1.5 })

  // Name: first line solid, second outlined (the sport when there is one line).
  const [first, second] = c.names.length > 1 ? c.names : [c.names[0], c.sport]
  const p1 = fit(ctx, first, (px) => display(px), 128, 369, 40, -3)
  text(ctx, first, 18, 58 + p1 * 0.8, display(p1), INK, { spacing: (-3 * p1) / 128, maxW: 369 })
  const p2 = fit(ctx, second, (px) => display(px), 128, 369, 40, -3)
  text(ctx, second, 18, 152 + p2 * 0.8, display(p2), INK, { spacing: (-3 * p2) / 128, stroke: 3, maxW: 369 })

  // Portrait in the pin
  ctx.save()
  const pin = path(POSTER_PIN, 62, 262, 1)
  ctx.fillStyle = INK
  ctx.fill(pin)
  ctx.clip(pin)
  jersey(ctx, c.number, 62 + 20 + measure(ctx, c.number ?? '', display(150)), 262 + 40 + 120, 150, frame, 0.6)
  bust(ctx, c.art, 212, 590, 285, frame)
  ctx.restore()

  // Rating sticker (rotated 6°)
  const rating = String(card.rating)
  const sw = Math.max(measure(ctx, rating, display(56)), Math.min(measure(ctx, c.sport, sans(10), 1.5), 90)) + 30
  const sh = 79.7
  ctx.save()
  ctx.translate(389 - sw / 2, 300 + sh / 2)
  ctx.rotate((6 * Math.PI) / 180)
  ctx.fillStyle = INK
  ctx.fillRect(-sw / 2, -sh / 2, sw, sh)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-sw / 2 + 3, -sh / 2 + 3, sw - 6, sh - 6)
  text(ctx, rating, 0, -sh / 2 + 11 + 56 * 0.825, display(56), INK, { align: 'center' })
  text(ctx, c.sport, 0, -sh / 2 + 11 + 47.6 + 9.7, sans(10), INK, { align: 'center', spacing: 1.5, maxW: sw - 12 })
  ctx.restore()

  // Stickers
  const tags: [string, string, string][] = [
    [fill(L.wins, { n: card.win_pct }), INK, '#ffffff'],
    [card.king_of ? L.king : fill(L.gamesCount, { n: card.games }), '#ffffff', INK],
  ]
  tags.forEach(([label, bg, fg], i) => {
    const w = measure(ctx, label, display(22)) + 20
    const top = 470 + i * (32.4 + 6)
    ctx.save()
    ctx.translate(14 + w / 2, top + 16.2)
    ctx.rotate((-3 * Math.PI) / 180)
    ctx.fillStyle = bg
    ctx.fillRect(-w / 2, -16.2, w, 32.4)
    text(ctx, label, -w / 2 + 10, -16.2 + 3 + 22 * 1, display(22), fg)
    ctx.restore()
  })

  // Footer
  ctx.fillStyle = INK
  ctx.fillRect(0, 643.5, DW, DH - 643.5)
  const streak = fill(L.streakN, { n: card.win_streak })
  const elo = `ELO ${card.elo}`
  const rw = Math.max(measure(ctx, streak, sans(11), 1.5), measure(ctx, elo, display(26)))
  text(ctx, streak, 383, 668.2, sans(11), MUTED, { align: 'right', spacing: 1.5 })
  text(ctx, elo, 383, 697.3, display(26), frame, { align: 'right' })
  const maxL = 361 - rw - 16
  const who = `@${card.user.username} · ${L.homeCourt}`
  const whoPx = fit(ctx, who, (px) => sans(px), 11, maxL, 8, 1.5)
  text(ctx, who, 22, 668.2, sans(whoPx), MUTED, { spacing: 1.5, maxW: maxL })
  const court = card.home_court?.name.toUpperCase() ?? '—'
  const cpx = fit(ctx, court, (px) => display(px), 26, maxL, 14)
  text(ctx, court, 22, 697.3, display(cpx), '#ffffff', { maxW: maxL })
}

// ---------------------------------------------------------------------------
// 3 · Scoreboard
// ---------------------------------------------------------------------------
function drawScoreboard(ctx: Ctx, c: Ready) {
  const { card, labels: L, frame } = c
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, DW, DH)
  brand(ctx, 22, 42, 20, 900)
  text(ctx, `${c.tier} · ${fill(L.serial, { n: c.serial })}`, 383, 38, sans(11), frame, { align: 'right', spacing: 2 })

  // Player panel
  poly(ctx, 22, 58, [[22, 0], [339, 0], [361, 22], [361, 120], [0, 120], [0, 22]])
  ctx.fillStyle = frame
  ctx.fill()
  ctx.save()
  poly(ctx, 26, 62, [[19, 0], [334, 0], [353, 19], [353, 116], [0, 116], [0, 19]])
  ctx.fillStyle = INK
  ctx.fill()
  ctx.clip()
  jersey(ctx, c.number, 385, base(44, 140, 0.8), 140, frame, 0.3)
  const pin = path(BOARD_PIN, 42, 76, 78 / 64, 88 / 72)
  ctx.fillStyle = frame
  ctx.fill(pin)
  ctx.save()
  ctx.clip(pin)
  bust(ctx, c.art, 81, 160, 74, frame)
  ctx.restore()
  const name = c.names.join(' ')
  const namePx = fit(ctx, name, (px) => display(px), 36, 229, 16)
  text(ctx, name, 134, 127.15, display(namePx), '#ffffff', { maxW: 229 })
  const sub = [`@${card.user.username}`, card.sport?.name, fill(L.levelShort, { n: card.level })].filter(Boolean).join(' · ')
  const subPx = fit(ctx, sub, (px) => sans(px, 700), 12, 229)
  text(ctx, sub, 134, 141.5, sans(subPx, 700), MUTED, { maxW: 229 })
  ctx.restore()

  // Record panel
  ctx.fillStyle = '#262c36'
  ctx.fillRect(22, 190, 361, 151.8)
  ctx.fillStyle = INK
  ctx.fillRect(24, 192, 357, 147.8)
  ctx.save()
  ctx.beginPath()
  ctx.rect(24, 192, 357, 147.8)
  ctx.clip()
  ctx.globalAlpha = 0.14
  ctx.strokeStyle = frame
  ctx.lineWidth = 3
  ctx.translate(22, 190)
  ctx.beginPath()
  ctx.moveTo(180, 0)
  ctx.lineTo(180, 170)
  ctx.moveTo(0, 40)
  ctx.lineTo(46, 40)
  ctx.lineTo(46, 130)
  ctx.lineTo(0, 130)
  ctx.moveTo(361, 40)
  ctx.lineTo(315, 40)
  ctx.lineTo(315, 130)
  ctx.lineTo(361, 130)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(180, 85, 42, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
  text(ctx, L.record, 202.5, 214.7, sans(11), MUTED, { align: 'center', spacing: 2.5 })
  const wins = String(card.wins)
  const losses = String(card.losses)
  const w1 = Math.max(measure(ctx, wins, display(96)), measure(ctx, L.winsLabel, sans(11), 2))
  const w2 = Math.max(measure(ctx, losses, display(96)), measure(ctx, L.lossesLabel, sans(11), 2))
  const wc = measure(ctx, ':', display(44))
  const { x1, xc, x2 } = recordLayout(w1, w2, wc)
  text(ctx, wins, x1 + w1 / 2, 303.3, display(96), frame, { align: 'center' })
  text(ctx, L.winsLabel, x1 + w1 / 2, 321.2, sans(11), '#ffffff', { align: 'center', spacing: 2 })
  text(ctx, ':', xc, 289.15, display(44), '#4a525e')
  text(ctx, losses, x2 + w2 / 2, 303.3, display(96), '#ffffff', { align: 'center' })
  text(ctx, L.lossesLabel, x2 + w2 / 2, 321.2, sans(11), '#ffffff', { align: 'center', spacing: 2 })

  // Rating · Elo · streak
  const delta = card.elo_delta_30d
  const cells: [string, string, string, string][] = [
    [String(card.rating), L.rating, frame, MUTED],
    [String(card.elo), `ELO ${formatEloDelta(delta)}`, '#ffffff', delta > 0 ? '#3fd27a' : delta < 0 ? '#ff6b5a' : MUTED],
    [String(card.win_streak), L.streakLong, '#ffffff', MUTED],
  ]
  cells.forEach(([v, label, vc, lc], i) => {
    const x = 22 + i * (115 + 8)
    ctx.fillStyle = INK
    ctx.fillRect(x, 353.8, 115, 75.1)
    ctx.fillStyle = i === 0 ? frame : '#262c36'
    ctx.fillRect(x, 353.8, 115, 3)
    text(ctx, v, x + 57.5, 402.8, display(40), vc, { align: 'center', maxW: 105 })
    text(ctx, label, x + 57.5, 416.5, sans(10), lc, { align: 'center', spacing: 1.5, maxW: 105 })
  })

  // Court panel
  const top = 440.9
  const h = 698 - top
  poly(ctx, 22, top, [[0, 0], [361, 0], [361, h - 46], [180.5, h], [0, h - 46]])
  ctx.fillStyle = frame
  ctx.fill()
  if (card.king_of) {
    ctx.save()
    ctx.lineWidth = 2.2
    ctx.lineJoin = 'round'
    ctx.strokeStyle = INK
    ctx.stroke(path(CROWN, 202.5 - 14, top + 14, 28 / 24))
    ctx.restore()
  } else {
    logoPin(ctx, 202.5, top + 14, 24, INK, frame)
  }
  text(ctx, card.king_of ? L.king : L.homeCourt, 202.5, interBase(top + 44, 11), sans(11), INK, { align: 'center', spacing: 2 })
  const court = (card.king_of ?? card.home_court)?.name.toUpperCase() ?? '—'
  const cpx = fit(ctx, court, (px) => display(px), 28, 325, 14)
  text(ctx, court, 202.5, top + 59.3 + 25.2, display(cpx), INK, { align: 'center', maxW: 325 })
  text(ctx, `${L.beatMe} ${DOMAIN}`, 202.5, interBase(top + 93.3, 12), sans(12), INK, { align: 'center', maxW: 325 })
}

// ---------------------------------------------------------------------------
// 4 · Court pass
// ---------------------------------------------------------------------------
async function drawPass(ctx: Ctx, c: Ready) {
  const { card, labels: L, frame } = c
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, DW, DH)
  brand(ctx, 22, 44, 20, 900)
  text(ctx, fill(L.pass, { tier: c.tier }), 383, 40, sans(11), frame, { align: 'right', spacing: 2 })

  shield(ctx, 22, 60, 361, 628, 30, 92)
  ctx.fillStyle = frame
  ctx.fill()
  ctx.save()
  shield(ctx, 27, 65, 351, 618, 27, 90)
  ctx.fillStyle = '#f6f3ee'
  ctx.fill()
  ctx.clip()
  ctx.translate(27, 65)

  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(175, -30, 210, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(115, 0)
  ctx.lineTo(115, 140)
  ctx.lineTo(235, 140)
  ctx.lineTo(235, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(175, 140, 56, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // Portrait pin + identity
  const pin = path(PASS_PIN, 22, 24, 1)
  ctx.fillStyle = INK
  ctx.fill(pin)
  ctx.save()
  ctx.clip(pin)
  bust(ctx, c.art, 76, 146, 112, frame)
  ctx.restore()

  const lines = c.names.slice(0, 2)
  const blockTop = lines.length > 1 ? 30.7 : 48
  lines.forEach((line, i) => {
    const px = fit(ctx, line, (p) => display(p), 40, 185, 16)
    text(ctx, line, 144, blockTop + 34.4 * i + 40 * 0.83, display(px), INK, { maxW: 185 })
  })
  const after = blockTop + 34.4 * lines.length
  const handle = `@${card.user.username} · ${fill(L.serial, { n: c.serial })}`
  const hpx = fit(ctx, handle, (p) => sans(p, 700), 12, 185)
  text(ctx, handle, 144, after + 4 + 11.6, sans(hpx, 700), '#5b6470', { maxW: 185 })
  const chips = [card.sport, ...card.sports.filter((s) => s.id !== card.sport?.id)].filter((s) => !!s).slice(0, 3)
  let chipX = 144
  chips.forEach((s, i) => {
    const label = L.sportShort[s.slug] ?? s.name.toUpperCase()
    const w = measure(ctx, label, sans(11)) + 16
    if (chipX + w > 329) return
    ctx.beginPath()
    ctx.roundRect(chipX, after + 24.5, w, 21.3, 11)
    ctx.fillStyle = i === 0 ? frame : INK
    ctx.fill()
    text(ctx, label, chipX + 8, after + 24.5 + 4 + 10.66, sans(11), i === 0 ? INK : '#ffffff')
    chipX += w + 6
  })

  // Stats
  const stats: [string, string][] = [
    [String(card.rating), L.rating],
    [String(card.games), L.gamesLong],
    [String(card.elo), L.elo],
  ]
  stats.forEach(([v, label], i) => {
    const x = 22 + i * (97 + 8)
    if (i === 0) {
      ctx.fillStyle = INK
      ctx.fillRect(x, 172, 97, 68.1)
    } else {
      ctx.fillStyle = INK
      ctx.fillRect(x, 172, 97, 68.1)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + 2, 174, 93, 64.1)
    }
    text(ctx, v, x + 48.5, 214.4, display(36), i === 0 ? frame : INK, { align: 'center', maxW: 89 })
    text(ctx, label, x + 48.5, 227.7, sans(10), i === 0 ? '#ffffff' : '#5b6470', { align: 'center', spacing: 1.5, maxW: 89 })
  })

  const where = [card.home_court?.name, fill(L.levelLong, { n: card.level })].filter(Boolean).join(' · ')
  const wpx = fit(ctx, where, (p) => sans(p, 700), 12, 307)
  text(ctx, where, 175.5, interBase(262, 12), sans(wpx, 700), '#5b6470', { align: 'center', maxW: 307 })

  // Perforation
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(0, 314, 18, -Math.PI / 2, Math.PI / 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(351, 314, 18, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.fill()
  ctx.save()
  ctx.setLineDash([9, 6])
  ctx.strokeStyle = '#c9c3b8'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(18, 314)
  ctx.lineTo(333, 314)
  ctx.stroke()
  ctx.restore()

  // QR to the profile
  const scanPx = fit(ctx, L.scan, (p) => display(p), 30, 307, 16)
  text(ctx, L.scan, 175.5, 338 + scanPx * 0.9, display(scanPx), INK, { align: 'center', maxW: 307 })
  ctx.fillStyle = INK
  ctx.fillRect(98.5, 376, 154, 154)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(101.5, 379, 148, 148)
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, c.profileUrl, { width: 480, margin: 0, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } })
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qr, 109.5, 387, 132, 132)
  ctx.imageSmoothingEnabled = true
  const link = c.profileUrl.replace(/^https?:\/\//, '')
  const lpx = fit(ctx, link, (p) => sans(p), 12, 307)
  text(ctx, link, 175.5, interBase(538, 12), sans(lpx), INK, { align: 'center', maxW: 307 })

  logoPin(ctx, 175.5, 560, 24, frame, '#f6f3ee')
  ctx.restore()
}

async function loadArt(input: PlayerCardImageInput): Promise<Art> {
  try {
    if (input.avatar) return { img: await svgImage(avataaarsSvg(input.avatar, { mouth: 'smile' })), photo: false }
    if (input.photoUrl) return { img: await loadImage(input.photoUrl, true), photo: true }
  } catch {
    // fall back to the silhouette
  }
  return null
}

async function loadIcon(svg: string | null): Promise<HTMLImageElement | null> {
  if (!svg) return null
  try {
    const markup = svg
      .replace(/currentColor/g, '#ffffff')
      .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"')
    return await svgImage(markup)
  } catch {
    return null
  }
}

/** Draws the player card in the chosen style and returns a 1080×1920 PNG. */
export async function renderPlayerCard(input: PlayerCardImageInput): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load(display(100)),
      document.fonts.load(display(100, 800)),
      document.fonts.load(sans(20)),
      document.fonts.load(sans(20, 700)),
    ])
  } catch {
    // fall back to system fonts
  }
  const { card, labels } = input
  const [art, icon] = await Promise.all([loadArt(input), loadIcon(input.sportIconSvg)])
  const ready: Ready = {
    ...input,
    frame: tierColor(card.tier),
    tier: labels.tiers[card.tier] ?? card.tier.toUpperCase(),
    sport: card.sport ? (labels.sportShort[card.sport.slug] ?? card.sport.name.toUpperCase()) : '',
    serial: formatSerial(card.serial),
    number: input.avatar ? kitOf(input.avatar).number || null : null,
    art,
    icon,
  }

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!
  ctx.scale(CARD_W / DW, CARD_H / DH)
  if (input.style === 'poster') drawPoster(ctx, ready)
  else if (input.style === 'scoreboard') drawScoreboard(ctx, ready)
  else if (input.style === 'pass') await drawPass(ctx, ready)
  else drawTradingCard(ctx, ready)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'))
}
