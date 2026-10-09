import type { PlayerAvatarConfig } from '../avatar/schema'
import { avataaarsSvg } from '../avatar/render/avataaars'
import type { PublicUser } from './types'

/** 9:16 — WhatsApp status / Instagram story. */
const W = 1080
const H = 1920

export type MonthlyRecap = {
  month: string
  games: number
  hours: number
  courts: number
  check_ins: number
  showed_up: number
  show_up_pct: number | null
  games_created: number
  top_court: { id: string; name: string; visits: number } | null
  top_teammate: { user: PublicUser; games: number } | null
}

export type RecapStoryInput = {
  recap: MonthlyRecap
  username: string
  avatar: PlayerAvatarConfig | null
  teammateAvatar: PlayerAvatarConfig | null
  monthLabel: string
  labels: { games: string; hours: string; courts: string; showUp: string; topCourt: string; topTeammate: string; together: string; footer: string }
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, max: number) {
  let px = start
  ctx.font = font(px)
  while (ctx.measureText(text).width > max && px > 24) {
    px -= 4
    ctx.font = font(px)
  }
}

async function avatarDisc(ctx: CanvasRenderingContext2D, avatar: PlayerAvatarConfig | null, initials: string, cx: number, cy: number, r: number, fill: string, bg = 'rgba(255,255,255,0.92)') {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.clip()
  if (avatar) {
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(avataaarsSvg(avatar, { mouth: 'smile', eyes: 'happy' }))}`)
    const size = r * 2 * 0.92
    ctx.drawImage(img, cx - size / 2, cy - r + r * 0.18, size, size)
  } else {
    ctx.fillStyle = fill
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${Math.round(r * 0.9)}px "Barlow Condensed", sans-serif`
    ctx.fillText(initials.slice(0, 2).toUpperCase(), cx, cy + r * 0.05)
  }
  ctx.restore()
  ctx.lineWidth = Math.max(6, r * 0.05)
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

/** Draws the monthly recap story in the player's base-sport colours; returns a PNG blob. */
export async function renderRecapStory(input: RecapStoryInput): Promise<Blob> {
  const { recap, labels } = input
  const brand = cssVar('--brand', '#ff5a1f')
  const deep = cssVar('--sport-deep', '#7a1f00')
  const accent = cssVar('--sport-accent', '#ffb020')
  const display = (px: number) => `800 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`
  const sans = (px: number, w = 600) => `${w} ${px}px Inter, system-ui, sans-serif`
  try {
    await Promise.all([document.fonts.load(display(120)), document.fonts.load(sans(40))])
  } catch {
    // system fonts
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H)
  bg.addColorStop(0, brand)
  bg.addColorStop(1, deep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.9, 260, 0, W * 0.9, 260, 760)
  glow.addColorStop(0, `${accent}77`)
  glow.addColorStop(1, `${accent}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // Court lines as a quiet texture.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(W / 2, H + 120, 620, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, H - 500)
  ctx.lineTo(W, H - 500)
  ctx.stroke()

  // Header: brand + month
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'start'
  ctx.font = display(56)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('OUT FOR', 80, 150)
  ctx.fillStyle = accent
  ctx.fillText('GROUND', 80 + ctx.measureText('OUT FOR ').width, 150)
  ctx.fillStyle = '#ffffff'
  fitFont(ctx, input.monthLabel.toUpperCase(), display, 150, W - 160)
  ctx.fillText(input.monthLabel.toUpperCase(), 80, 300)

  // Player
  await avatarDisc(ctx, input.avatar, input.username, W - 230, 470, 150, brand)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  fitFont(ctx, `@${input.username}`, display, 72, W - 160 - 340)
  ctx.fillText(`@${input.username}`, 80, 440)

  // Big number
  ctx.fillStyle = '#ffffff'
  ctx.font = display(380)
  ctx.fillText(String(recap.games), 70, 860)
  const gw = ctx.measureText(String(recap.games)).width
  ctx.font = display(84)
  ctx.fillStyle = accent
  ctx.fillText(labels.games.toUpperCase(), 70 + gw + 24, 860)

  // Stat tiles
  const tiles: [string, string][] = [
    [String(recap.hours).replace('.0', ''), labels.hours],
    [String(recap.courts), labels.courts],
    [recap.show_up_pct == null ? '—' : `${recap.show_up_pct}%`, labels.showUp],
  ]
  const tileW = (W - 160 - 2 * 28) / 3
  tiles.forEach(([value, label], i) => {
    const x = 80 + i * (tileW + 28)
    const y = 940
    ctx.beginPath()
    ctx.roundRect(x, y, tileW, 230, 32)
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    fitFont(ctx, value, display, 120, tileW - 40)
    ctx.fillText(value, x + tileW / 2, y + 135)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    fitFont(ctx, label, (px) => sans(px, 700), 30, tileW - 30)
    ctx.fillText(label, x + tileW / 2, y + 190)
  })

  // Home court + top teammate cards
  ctx.textAlign = 'start'
  let y = 1230
  const card = (h: number) => {
    ctx.beginPath()
    ctx.roundRect(80, y, W - 160, h, 36)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
  if (recap.top_court) {
    card(170)
    ctx.fillStyle = brand
    ctx.font = sans(30, 800)
    ctx.fillText(labels.topCourt.toUpperCase(), 124, y + 62)
    ctx.fillStyle = '#12151a'
    fitFont(ctx, recap.top_court.name, display, 72, W - 260)
    ctx.fillText(recap.top_court.name, 124, y + 136)
    y += 200
  }
  if (recap.top_teammate) {
    card(190)
    const u = recap.top_teammate.user
    await avatarDisc(ctx, input.teammateAvatar, u.username, 190, y + 95, 66, brand, `${brand}22`)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = brand
    ctx.font = sans(30, 800)
    ctx.fillText(labels.topTeammate.toUpperCase(), 290, y + 62)
    ctx.fillStyle = '#12151a'
    fitFont(ctx, `@${u.username}`, display, 64, W - 420)
    ctx.fillText(`@${u.username}`, 290, y + 126)
    ctx.fillStyle = '#5b6170'
    ctx.font = sans(28, 600)
    ctx.fillText(labels.together.replace('{n}', String(recap.top_teammate.games)), 290, y + 166)
  }

  // Footer
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = sans(34, 700)
  ctx.fillText(labels.footer, W / 2, H - 90)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'))
}
