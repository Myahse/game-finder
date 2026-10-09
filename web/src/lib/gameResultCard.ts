import QRCode from 'qrcode'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { avataaarsSvg } from '../avatar/render/avataaars'
import type { ScoreTeam } from './scoreboard'

/** 4:5 portrait, same frame as the profile card. */
const W = 1080
const H = 1350

export type ResultPlayer = { username: string; avatar: PlayerAvatarConfig | null; value: number; mvp: boolean }

export type ResultCardInput = {
  url: string
  sportName: string
  courtName: string
  dateLabel: string
  teams: ScoreTeam[]
  winnerPosition: number | null
  top: ResultPlayer[]
  labels: { winner: string; draw: string; mvp: string; topPlayers: string; stat: string; scan: string }
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

function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, max: number) {
  let px = start
  ctx.font = font(px)
  while (ctx.measureText(text).width > max && px > 20) {
    px -= 2
    ctx.font = font(px)
  }
}

async function disc(ctx: CanvasRenderingContext2D, avatar: PlayerAvatarConfig | null, name: string, cx: number, cy: number, r: number, ring: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.clip()
  if (avatar) {
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(avataaarsSvg(avatar, { mouth: 'smile' }))}`)
    const size = r * 2 * 0.92
    ctx.drawImage(img, cx - size / 2, cy - r + r * 0.18, size, size)
  } else {
    ctx.fillStyle = ring
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${Math.round(r * 0.9)}px "Barlow Condensed", sans-serif`
    ctx.fillText(name.slice(0, 2).toUpperCase(), cx, cy + r * 0.05)
  }
  ctx.restore()
  ctx.lineWidth = 6
  ctx.strokeStyle = ring
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

/** Game result card: score, teams, top players and a QR code back to the game. */
export async function renderResultCard(input: ResultCardInput): Promise<Blob> {
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

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#12151a')
  bg.addColorStop(1, deep)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 360, 0, W / 2, 360, 700)
  glow.addColorStop(0, `${brand}55`)
  glow.addColorStop(1, `${brand}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'start'
  ctx.font = display(52)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('OUT FOR', 70, 110)
  ctx.fillStyle = accent
  ctx.fillText('GROUND', 70 + ctx.measureText('OUT FOR ').width, 110)
  ctx.textAlign = 'end'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = sans(30, 700)
  ctx.fillText(input.dateLabel, W - 70, 108)
  ctx.textAlign = 'start'
  ctx.fillStyle = '#ffffff'
  fit(ctx, input.courtName.toUpperCase(), display, 92, W - 140)
  ctx.fillText(input.courtName.toUpperCase(), 70, 210)
  ctx.fillStyle = accent
  ctx.font = sans(32, 700)
  ctx.fillText(input.sportName, 70, 260)

  // Score
  let y = 300
  const teams = input.teams.slice(0, 4)
  const scored = teams.length >= 2 && teams.some((t) => t.score > 0)
  if (scored && teams.length === 2) {
    const [a, b] = teams
    ctx.textAlign = 'center'
    const colX = [W * 0.27, W * 0.73]
    ;[a, b].forEach((t, i) => {
      const won = input.winnerPosition === (t.position ?? i)
      ctx.fillStyle = t.color
      ctx.beginPath()
      ctx.roundRect(colX[i] - 210, y + 20, 420, 330, 36)
      ctx.globalAlpha = won ? 0.95 : 0.55
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      fit(ctx, t.name.toUpperCase(), display, 56, 380)
      ctx.fillText(t.name.toUpperCase(), colX[i], y + 95)
      ctx.font = display(200)
      ctx.fillText(String(t.score), colX[i], y + 285)
      if (won) {
        ctx.font = sans(28, 800)
        ctx.fillStyle = '#12151a'
        const label = `★ ${input.labels.winner.toUpperCase()}`
        const w = ctx.measureText(label).width + 36
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.roundRect(colX[i] - w / 2, y + 315, w, 50, 25)
        ctx.fill()
        ctx.fillStyle = '#12151a'
        ctx.fillText(label, colX[i], y + 350)
      }
    })
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = display(80)
    ctx.fillText('–', W / 2, y + 215)
    if (input.winnerPosition == null) {
      ctx.font = sans(30, 800)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(input.labels.draw.toUpperCase(), W / 2, y + 400)
    }
    y += 420
  } else if (scored) {
    ctx.textAlign = 'start'
    const sorted = [...teams].sort((p, q) => q.score - p.score)
    for (const t of sorted) {
      ctx.fillStyle = t.color
      ctx.beginPath()
      ctx.roundRect(70, y + 10, W - 140, 90, 24)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      fit(ctx, t.name.toUpperCase(), display, 54, W - 400)
      ctx.fillText(t.name.toUpperCase(), 110, y + 75)
      ctx.textAlign = 'end'
      ctx.font = display(70)
      ctx.fillText(String(t.score), W - 110, y + 80)
      ctx.textAlign = 'start'
      y += 105
    }
    y += 20
  }

  // Top players
  if (input.top.length > 0) {
    ctx.textAlign = 'start'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = sans(28, 800)
    ctx.fillText(input.labels.topPlayers.toUpperCase(), 70, y + 30)
    const n = input.top.length
    const slot = (W - 140) / n
    for (let i = 0; i < n; i++) {
      const p = input.top[i]
      const cx = 70 + slot * i + slot / 2
      const r = n === 1 ? 90 : 72
      await disc(ctx, p.avatar, p.username, cx, y + 70 + r, r, p.mvp ? accent : '#ffffff')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#ffffff'
      fit(ctx, `@${p.username}`, (px) => sans(px, 700), 30, slot - 20)
      ctx.fillText(`@${p.username}`, cx, y + 70 + r * 2 + 44)
      ctx.font = display(46)
      ctx.fillStyle = accent
      const line = p.value > 0 ? `${p.value} ${input.labels.stat}` : ''
      ctx.fillText(p.mvp ? `${line}${line ? ' · ' : ''}${input.labels.mvp}` : line, cx, y + 70 + r * 2 + 94)
    }
  }

  // QR strip
  const py = H - 230
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(70, py, W - 140, 180, 30)
  ctx.fill()
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, input.url, { width: 150, margin: 0, errorCorrectionLevel: 'M', color: { dark: '#12151a', light: '#ffffff' } })
  ctx.drawImage(qr, 85, py + 15, 150, 150)
  ctx.textAlign = 'start'
  ctx.fillStyle = '#12151a'
  ctx.font = display(48)
  const lines = input.labels.scan.split('\n')
  lines.forEach((l, i) => ctx.fillText(l.toUpperCase(), 270, py + 70 + i * 46))
  ctx.fillStyle = brand
  const link = input.url.replace(/^https?:\/\//, '')
  fit(ctx, link, (px) => sans(px, 700), 28, W - 140 - 230)
  ctx.fillText(link, 270, py + 70 + lines.length * 46 + 10)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('render failed'))), 'image/png'))
}
