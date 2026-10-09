import QRCode from 'qrcode'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { avataaarsSvg } from '../avatar/render/avataaars'

/** 4:5 portrait — fits Instagram/WhatsApp status and phone screens. */
const W = 1080
const H = 1350

export type ProfileCardInput = {
  username: string
  url: string
  avatar: PlayerAvatarConfig | null
  /** e.g. "Football · Intermediate" */
  subtitle: string
  cta: string
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Shrink text until it fits `max` px wide. */
function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, max: number) {
  let px = start
  ctx.font = font(px)
  while (ctx.measureText(text).width > max && px > 24) {
    px -= 4
    ctx.font = font(px)
  }
}

/**
 * Draws a shareable profile card (avatar, @username, sport, QR code + link) in the
 * player's base-sport colours and returns it as a PNG blob. Everything is drawn locally.
 */
export async function renderProfileCard(input: ProfileCardInput): Promise<Blob> {
  const brand = cssVar('--brand', '#ff5a1f')
  const deep = cssVar('--sport-deep', '#7a1f00')
  const accent = cssVar('--sport-accent', '#ffb020')
  const display = (px: number) => `800 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`
  const sans = (px: number, w = 600) => `${w} ${px}px Inter, system-ui, sans-serif`
  try {
    await Promise.all([document.fonts.load(display(120)), document.fonts.load(sans(40))])
  } catch {
    // fall back to system fonts
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background: base-sport gradient with a soft accent glow.
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, brand)
  bg.addColorStop(1, deep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 620)
  glow.addColorStop(0, `${accent}66`)
  glow.addColorStop(1, `${accent}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Brand line
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  ctx.font = display(64)
  ctx.fillText('OUT FOR', 80, 140)
  const w = ctx.measureText('OUT FOR ').width
  ctx.fillStyle = accent
  ctx.fillText('GROUND', 80 + w, 140)

  // Avatar disc
  const cx = W / 2
  const cy = 430
  const r = 230
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.clip()
  if (input.avatar) {
    const svg = avataaarsSvg(input.avatar)
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    const size = r * 2 * 0.92
    ctx.drawImage(img, cx - size / 2, cy - r + r * 0.18, size, size)
  } else {
    ctx.fillStyle = brand
    ctx.font = display(200)
    ctx.textAlign = 'center'
    ctx.fillText(input.username.slice(0, 2).toUpperCase(), cx, cy + 70)
    ctx.textAlign = 'start'
  }
  ctx.restore()
  ctx.lineWidth = 10
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  // Name + sport
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  const handle = `@${input.username}`
  fitText(ctx, handle, display, 120, W - 160)
  ctx.fillText(handle, cx, 790)
  ctx.font = sans(40)
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(input.subtitle, cx, 850)

  // QR panel
  const qrSize = 300
  const panelW = W - 160
  const panelH = 360
  const px = 80
  const py = 920
  roundRect(ctx, px, py, panelW, panelH, 36)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, input.url, { width: qrSize, margin: 0, errorCorrectionLevel: 'M', color: { dark: '#12151a', light: '#ffffff' } })
  ctx.drawImage(qr, px + 30, py + 30, qrSize, qrSize)

  ctx.textAlign = 'start'
  const tx = px + 30 + qrSize + 36
  const tw = panelW - (tx - px) - 30
  ctx.fillStyle = '#12151a'
  ctx.font = display(64)
  const lines = input.cta.split('\n')
  lines.forEach((line, i) => ctx.fillText(line.toUpperCase(), tx, py + 110 + i * 64))
  ctx.fillStyle = brand
  const link = input.url.replace(/^https?:\/\//, '')
  fitText(ctx, link, (px2) => sans(px2, 700), 34, tw)
  ctx.fillText(link, tx, py + 110 + lines.length * 64 + 40)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'))
}
