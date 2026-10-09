import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import QRCode from 'qrcode'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { AvatarPortrait } from '../avatar/render/AvatarPortrait'
import { kitOf } from '../avatar/render/kit'
import type { en as cardMessages } from '../i18n/screens/card'
import { useCountUp } from '../lib/motion'
import { formatEloDelta, formatSerial, tierColor, type CardStyle, type PlayerCard } from '../lib/playerCard'
import {
  BOARD_PIN,
  CROWN,
  DH,
  DOMAIN,
  DW,
  INK,
  MUTED,
  PASS_PIN,
  PIN,
  POSTER_PIN,
  base,
  display,
  fillLabel,
  fitSize,
  interBase,
  letterOffsets,
  polyPath,
  recordLayout,
  sans,
  scalePath,
  shieldPath,
} from '../lib/playerCardLayout'
import { SportIcon } from './icons'

/*
 * The player card as live DOM/SVG: the same layout as the exported PNG (lib/playerCardImage.ts),
 * drawn in the 405×720 design space and scaled to its box, with an intro that plays on mount
 * (court lines draw in, numbers count up, the name band slides in…) and quiet idle loops.
 * Animations are the ftg-card-* classes in index.css. Remount (key) to replay the intro.
 */

export type PlayerCardLiveProps = {
  card: PlayerCard
  style: CardStyle
  /** Name lines (first / last, or the username), uppercase. */
  names: string[]
  avatar: PlayerAvatarConfig | null
  /** Uploaded profile photo, used when there is no player avatar. */
  photoUrl: string | null
  profileUrl: string
  labels: typeof cardMessages
  className?: string
}

type Ready = PlayerCardLiveProps & { frame: string; tier: string; sport: string; serial: string; number: string | null }

// ── Text measuring (same canvas metrics as the export) ──────────────────────────────────────
let mctx: CanvasRenderingContext2D | null | undefined

function measure(s: string, font: string, spacing = 0): number {
  if (mctx === undefined) {
    try {
      mctx = document.createElement('canvas').getContext('2d')
    } catch {
      mctx = null
    }
  }
  if (!mctx) return s.length * (parseFloat(font.split(' ')[1]) || 12) * 0.5 + spacing * s.length
  const ctx: CanvasRenderingContext2D = mctx
  const canSpace = 'letterSpacing' in (ctx as object)
  ctx.font = font
  if (!canSpace) {
    // No canvas letter-spacing: CSS still applies it, so add it by hand.
    return ctx.measureText(s).width + spacing * Array.from(s).length
  }
  ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(s).width
  ctx.letterSpacing = '0px'
  return w
}

const fit = (s: string, font: (px: number) => string, px: number, maxW: number, min = 8, spacing = 0) =>
  fitSize((p) => measure(s, font(p), spacing), px, maxW, min)

// ── Fonts: lay out once Barlow / Inter are in (or after a short wait) ───────────────────────
let fontsLoaded = false
let fontsPromise: Promise<void> | null = null

function loadFonts(): Promise<void> {
  fontsPromise ??= Promise.race([
    Promise.all([display(100), display(100, 800), sans(20), sans(20, 700)].map((f) => document.fonts?.load(f))).then(() => undefined),
    new Promise<void>((r) => window.setTimeout(r, 2500)),
  ])
    .catch(() => undefined)
    .then(() => {
      fontsLoaded = true
    })
  return fontsPromise
}

function useCardFonts(): boolean {
  const [ready, setReady] = useState(fontsLoaded)
  useEffect(() => {
    if (ready) return
    let alive = true
    void loadFonts().then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])
  return ready
}

// ── Pieces ────────────────────────────────────────────────────────────────────────────────
const at = (s: number, extra?: CSSProperties): CSSProperties => ({ animationDelay: `${s}s`, ...extra })

type TxProps = {
  s: string
  x: number
  y: number
  font: string
  color: string
  align?: 'left' | 'center' | 'right'
  spacing?: number
  maxW?: number
  stroke?: number
  opacity?: number
  className?: string
  style?: CSSProperties
}

/** One line of text, positioned like canvas `fillText` (alphabetic baseline, maxW squeezes). */
function Tx({ s, x, y, font, color, align = 'left', spacing = 0, maxW, stroke, opacity, className, style }: TxProps) {
  const over = maxW != null && measure(s, font, spacing) > maxW
  return (
    <text
      x={x}
      y={y}
      textAnchor={align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'}
      fill={stroke ? 'none' : color}
      stroke={stroke ? color : undefined}
      strokeWidth={stroke}
      strokeLinejoin={stroke ? 'round' : undefined}
      opacity={opacity}
      textLength={over ? maxW : undefined}
      lengthAdjust={over ? 'spacingAndGlyphs' : undefined}
      className={className}
      style={{ font, letterSpacing: spacing ? `${spacing}px` : undefined, whiteSpace: 'pre', ...style }}
    >
      {s}
    </text>
  )
}

/** A number that counts up on mount; `pop` bounces it when it lands, `tick` flips each step. */
function CountTx({
  value,
  from = 0,
  delay = 0,
  duration = 700,
  format = String,
  pop,
  tick,
  ...rest
}: Omit<TxProps, 's'> & { value: number; from?: number; delay?: number; duration?: number; format?: (n: number) => string; pop?: boolean; tick?: boolean }) {
  const n = useCountUp(value, duration, from, delay * 1000)
  const cls = [rest.className, pop && n === value ? 'ftg-card-pop' : ''].filter(Boolean).join(' ')
  const t = <Tx {...rest} s={format(n)} className={cls || undefined} />
  return tick ? (
    <g key={n} className="ftg-card-tick">
      {t}
    </g>
  ) : (
    t
  )
}

function Brand({ x, y, px, weight, className, style }: { x: number; y: number; px: number; weight: number; className?: string; style?: CSSProperties }) {
  const sp = weight === 800 ? 0.5 : 0
  return (
    <text x={x} y={y} className={className} style={{ font: display(px, weight), letterSpacing: sp ? `${sp}px` : undefined, whiteSpace: 'pre', ...style }}>
      <tspan fill="#ffffff">OUT FOR </tspan>
      <tspan fill="#ff5a1f">GROUND</tspan>
    </text>
  )
}

type LineSpec = { d: string } | { c: [number, number, number]; flip?: boolean }

/** Court markings that draw themselves in, then breathe. */
function CourtLines({ items, color, alpha, width, delay = 0 }: { items: LineSpec[]; color: string; alpha: number; width: number; delay?: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeOpacity={alpha}>
      {items.map((it, i) => {
        const style = { animationDelay: `${delay + i * 0.09}s, ${1.7 + i * 0.35}s` }
        if ('d' in it) return <path key={i} d={it.d} pathLength={1} className="ftg-card-line" style={style} />
        const [cx, cy, r] = it.c
        // Circles start drawing at 3 o'clock; flip the ones whose visible part is the top half.
        return <circle key={i} cx={cx} cy={cy} r={r} pathLength={1} transform={it.flip ? `rotate(180 ${cx} ${cy})` : undefined} className="ftg-card-line" style={style} />
      })}
    </g>
  )
}

/** Giant outlined jersey number: strokes in, then drifts. */
function Jersey({ n, right, y, px, color, alpha }: { n: string | null; right: number; y: number; px: number; color: string; alpha: number }) {
  if (!n) return null
  return (
    <g className="ftg-card-drift">
      <Tx s={n} x={right} y={y} font={display(px)} color={color} align="right" stroke={2} opacity={alpha} className="ftg-card-jersey" />
    </g>
  )
}

function LogoPin({ cx, top, w, frame, hole }: { cx: number; top: number; w: number; frame: string; hole: string }) {
  const s = w / 64
  return (
    <>
      <path d={PIN} transform={`translate(${cx - w / 2} ${top}) scale(${s})`} fill={frame} />
      <circle cx={cx} cy={top + 25 * s} r={10 * s} fill="none" stroke={hole} strokeWidth={3 * s} />
    </>
  )
}

/** "N° 0042", typed in. */
function Serial({ s, x, y, font, color, spacing, delay }: { s: string; x: number; y: number; font: string; color: string; spacing: number; delay: number }) {
  return (
    <Tx s={s} x={x} y={y} font={font} color={color} align="center" spacing={spacing} className="ftg-card-type" style={at(delay, { animationTimingFunction: `steps(${Math.max(1, s.length)}, end)` })} />
  )
}

/** A sweep of light running around a frame outline. */
function Glint({ d, transform }: { d: string; transform?: string }) {
  return <path d={d} transform={transform} pathLength={1} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" className="ftg-card-glint" />
}

/** Player portrait (head and shoulders) standing on `bottom`, `size` wide; (ox, oy) is the container's origin. */
function Portrait({ c, cx, bottom, size, ox = 0, oy = 0, className, style }: { c: Ready; cx: number; bottom: number; size: number; ox?: number; oy?: number; className?: string; style?: CSSProperties }) {
  const box: CSSProperties = { position: 'absolute', left: cx - size / 2 - ox, top: bottom - size - oy, width: size, height: size, ...style }
  return (
    <div style={box} className={className}>
      {c.avatar ? <AvatarPortrait config={c.avatar} className="h-full w-full" /> : <Silhouette size={size} photoUrl={c.photoUrl} accent={c.frame} />}
    </div>
  )
}

/** No avatar: a silhouette, with the uploaded photo as the head when there is one. */
function Silhouette({ size: s, photoUrl, accent }: { size: number; photoUrl: string | null; accent: string }) {
  const id = useId()
  const [broken, setBroken] = useState(false)
  const r = s * 0.2
  const hy = s * 0.38
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} overflow="visible" aria-hidden>
      <path d={`M${s * 0.08} ${s}A${s * 0.42} ${s * 0.3} 0 0 1 ${s * 0.92} ${s}Z`} fill="#ffffff" />
      <polyline points={`${s * 0.35},${s * 0.73} ${s * 0.5},${s * 0.85} ${s * 0.65},${s * 0.73}`} fill="none" stroke={accent} strokeWidth={s * 0.03} />
      <circle cx={s / 2} cy={hy} r={r} fill="#8a5a3c" />
      {photoUrl && !broken && (
        <>
          <clipPath id={`${id}-h`}>
            <circle cx={s / 2} cy={hy} r={r} />
          </clipPath>
          <image href={photoUrl} x={s / 2 - r} y={hy - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-h)`} onError={() => setBroken(true)} />
        </>
      )}
    </svg>
  )
}

/** A full-size SVG layer in design coordinates. */
function Layer({ children }: { children: ReactNode }) {
  return (
    <svg className="pointer-events-none absolute inset-0" width={DW} height={DH} viewBox={`0 0 ${DW} ${DH}`} aria-hidden>
      {children}
    </svg>
  )
}

// ── 1 · Trading card ───────────────────────────────────────────────────────────────────────
function TradingCard({ c }: { c: Ready }) {
  const clip = `${useId()}-c`
  const { card, labels: L, frame } = c
  const ch = 605.5
  const ih = ch - 10
  const inner = shieldPath(0, 0, 351, ih, 27, 90)

  const rating = String(card.rating)
  const level = fillLabel(L.level, { n: card.level })
  const sportW = Math.min(measure(c.sport, display(17, 800), 1.5), 92)
  const colW = Math.max(measure(rating, display(84)), sportW, 34, measure(level, sans(11), 1))
  const cx = 22 + colW / 2
  const sportPx = fit(c.sport, (px) => display(px, 800), 17, 92, 8, 1.5)
  const k = Math.tan((4 * Math.PI) / 180) * 175.5
  const name = c.names.join(' ')
  const namePx = fit(name, (px) => display(px), 44, 321, 20)
  const where = [`@${card.user.username}`, card.home_court?.name].filter(Boolean).join(' · ')
  const wherePx = fit(where, (px) => sans(px, 700), 12, 321, 8, 0.5)
  const stats: [number, string][] = [
    [card.games, L.games],
    [card.win_pct, L.winPct],
    [card.win_streak, L.streak],
    [card.challenges_won, L.duels],
    [card.courts, L.courts],
    [card.elo, L.elo],
  ]
  const rows = [402, 446.6, 491.2]
  const lead = L.challengeMe
  const lw = measure(lead, sans(13, 700))
  const dw = measure(DOMAIN, sans(13, 700))
  const serial = fillLabel(L.serial, { n: c.serial })

  return (
    <>
      <Layer>
        <rect width={DW} height={DH} fill="#0b0d10" />
        <Brand x={22} y={45} px={19} weight={800} className="ftg-card-fade" style={at(0.15)} />
        <Tx s={`${c.tier} · ${L.season}`} x={383} y={41.4} font={sans(11)} color={frame} align="right" spacing={2} className="ftg-card-fade" style={at(0.45)} />
        <path d={shieldPath(22, 62.8, 361, ch, 30, 92)} fill={frame} />
        <g transform="translate(27 67.8)">
          <path d={inner} fill="#161a20" />
          <clipPath id={clip}>
            <path d={inner} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <CourtLines
              color={frame}
              alpha={0.22}
              width={3}
              items={[{ c: [175, -20, 230] }, { c: [175, -20, 150] }, { d: 'M115 0V150H235V0' }, { c: [175, 150, 60] }]}
            />
            <Jersey n={c.number} right={365} y={base(64, 230, 0.8)} px={230} color={frame} alpha={0.35} />
          </g>
        </g>
      </Layer>

      <div className="absolute inset-0" style={{ clipPath: `path('${shieldPath(27, 67.8, 351, ih, 27, 90)}')` }}>
        <Portrait c={c} cx={27 + 218} bottom={67.8 + 302} size={262} className="ftg-card-rise" style={at(0.2)} />
      </div>

      <Layer>
        <g transform="translate(27 67.8)" clipPath={`url(#${clip})`}>
          <CountTx value={card.rating} from={40} delay={0.3} duration={800} x={cx} y={base(22, 84, 0.82)} font={display(84)} color={frame} align="center" pop />
          <g className="ftg-card-fade" style={at(0.5)}>
            <Tx s={c.sport} x={cx} y={94.9 + sportPx} font={display(sportPx, 800)} color="#ffffff" align="center" spacing={1.5} maxW={92} />
            <rect x={cx - 17} y={119.3} width={34} height={2} fill={frame} />
            <Tx s={level} x={cx} y={interBase(161.3, 11)} font={sans(11)} color={MUTED} align="center" spacing={1} />
          </g>
          <g className="ftg-card-band" style={at(0.35)}>
            <path d={polyPath(0, 300, [[0, k], [351, -k], [351, 58 - k], [0, 58 + k]])} fill={frame} />
            <Tx s={name} x={175.5} y={308 + (44 - namePx) / 2 + namePx * 0.9} font={display(namePx)} color={INK} align="center" spacing={1} maxW={321} />
          </g>
          <Tx s={where} x={175.5} y={interBase(372, 12)} font={sans(wherePx, 700)} color={MUTED} align="center" spacing={0.5} maxW={321} className="ftg-card-rise" style={at(0.7)} />
          {stats.map(([v, label], i) => {
            const x = 26 + (i % 2) * (138.5 + 22)
            const top = rows[Math.floor(i / 2)]
            const y = top + 28
            const vw = Math.max(50, measure(String(v), display(28)))
            const delay = 0.6 + i * 0.06
            return (
              <g key={label} className="ftg-card-rise" style={at(delay)}>
                <CountTx value={v} delay={delay} duration={650} x={x} y={y} font={display(28)} color="#ffffff" />
                <Tx s={label} x={x + vw + 8} y={y} font={sans(12)} color={MUTED} spacing={1.5} maxW={138.5 - vw - 8} />
                {i < 4 && <rect x={x} y={top + 37.6} width={138.5} height={1} fill="#2b313b" />}
              </g>
            )
          })}
          <g className="ftg-card-drop" style={at(0.95)}>
            <LogoPin cx={175.5} top={ih - 80.1} w={26} frame={frame} hole="#161a20" />
          </g>
          <Serial s={serial} x={175.5} y={interBase(ih - 46.1, 10)} font={sans(10)} color="#8b939e" spacing={2} delay={1.1} />
        </g>
        <Glint d={shieldPath(24.5, 65.3, 356, ch - 5, 28.5, 91)} />
        <text x={DW / 2 - (lw + dw) / 2} y={interBase(62.8 + ch + 14, 13)} className="ftg-card-fade" style={{ font: sans(13, 700), whiteSpace: 'pre', ...at(1.15) }}>
          <tspan fill={MUTED}>{lead}</tspan>
          <tspan fill="#ffffff">{DOMAIN}</tspan>
        </text>
      </Layer>

      {card.sport && (
        <div className="ftg-card-fade pointer-events-none absolute text-white" style={{ left: 27 + cx - 15, top: 67.8 + 125.3, width: 30, height: 30, ...at(0.55) }}>
          <SportIcon slug={card.sport.slug} className="h-full w-full" />
        </div>
      )}
    </>
  )
}

// ── 2 · Street poster ──────────────────────────────────────────────────────────────────────
/** A big poster name line, letter by letter (squeezed like canvas maxW when too wide). */
function Letters({ s, x, y, px, stroke, delay }: { s: string; x: number; y: number; px: number; stroke?: number; delay: number }) {
  const font = display(px)
  const spacing = (-3 * px) / 128
  const total = measure(s, font, spacing)
  const k = total > 369 ? 369 / total : 1
  const offs = letterOffsets(s, (p) => measure(p, font, spacing))
  return (
    <g transform={`translate(${x} ${y}) scale(${k} 1)`}>
      {Array.from(s).map((ch, i) => (
        <text
          key={i}
          x={offs[i]}
          y={0}
          fill={stroke ? 'none' : INK}
          stroke={stroke ? INK : undefined}
          strokeWidth={stroke}
          strokeLinejoin="round"
          className="ftg-card-letter"
          style={{ font, letterSpacing: `${spacing}px`, whiteSpace: 'pre', ...at(delay + i * 0.045) }}
        >
          {ch}
        </text>
      ))}
    </g>
  )
}

function Poster({ c }: { c: Ready }) {
  const { card, labels: L, frame } = c
  const pill = `${c.tier} · ${fillLabel(L.serial, { n: c.serial })}`
  const pw = measure(pill, sans(11), 1.5) + 22
  const [first, second] = c.names.length > 1 ? c.names : [c.names[0], c.sport]
  const p1 = fit(first, (px) => display(px), 128, 369, 40, -3)
  const p2 = fit(second, (px) => display(px), 128, 369, 40, -3)
  const rating = String(card.rating)
  const sw = Math.max(measure(rating, display(56)), Math.min(measure(c.sport, sans(10), 1.5), 90)) + 30
  const sh = 79.7
  const tags: [string, string, string][] = [
    [fillLabel(L.wins, { n: card.win_pct }), INK, '#ffffff'],
    [card.king_of ? L.king : fillLabel(L.gamesCount, { n: card.games }), '#ffffff', INK],
  ]
  const streak = fillLabel(L.streakN, { n: card.win_streak })
  const elo = `ELO ${card.elo}`
  const rw = Math.max(measure(streak, sans(11), 1.5), measure(elo, display(26)))
  const maxL = 361 - rw - 16
  const who = `@${card.user.username} · ${L.homeCourt}`
  const whoPx = fit(who, (px) => sans(px), 11, maxL, 8, 1.5)
  const court = card.home_court?.name.toUpperCase() ?? '—'
  const cpx = fit(court, (px) => display(px), 26, maxL, 14)
  const numberRight = 62 + 20 + measure(c.number ?? '', display(150))

  return (
    <>
      <Layer>
        <rect width={DW} height={DH} fill={frame} />
        <CourtLines
          color={INK}
          alpha={0.12}
          width={4}
          items={[{ c: [202, 740, 300], flip: true }, { c: [202, 740, 200], flip: true }, { d: 'M132 720V520H272V720' }, { c: [202, 520, 70], flip: true }]}
        />
        <Tx s="OUT FOR GROUND" x={22} y={42} font={display(20)} color={INK} className="ftg-card-fade" style={at(0.1)} />
        <g className="ftg-card-fade" style={at(0.3)}>
          <rect x={383 - pw} y={22.35} width={pw} height={23.3} rx={11.65} fill={INK} />
          <Tx s={pill} x={383 - pw + 11} y={38} font={sans(11)} color={frame} spacing={1.5} />
        </g>
        <Letters s={first} x={18} y={58 + p1 * 0.8} px={p1} delay={0.05} />
        <Letters s={second} x={18} y={152 + p2 * 0.8} px={p2} stroke={3} delay={0.25} />
      </Layer>

      <div className="ftg-card-pinin absolute" style={{ left: 62, top: 262, width: 280, height: 330, clipPath: `path('${POSTER_PIN}')`, transformOrigin: '50% 45%', ...at(0.35) }}>
        <svg className="pointer-events-none absolute inset-0" width={280} height={330} viewBox="62 262 280 330" aria-hidden>
          <rect x={62} y={262} width={280} height={330} fill={INK} />
          <Jersey n={c.number} right={numberRight} y={262 + 40 + 120} px={150} color={frame} alpha={0.6} />
        </svg>
        <Portrait c={c} cx={212} bottom={590} size={285} ox={62} oy={262} />
      </div>

      <Layer>
        <Glint d={POSTER_PIN} transform="translate(62 262)" />
        <g transform={`translate(${389 - sw / 2} ${300 + sh / 2}) rotate(6)`}>
          <g className="ftg-card-slap" style={at(0.75)}>
            <rect x={-sw / 2} y={-sh / 2} width={sw} height={sh} fill={INK} />
            <rect x={-sw / 2 + 3} y={-sh / 2 + 3} width={sw - 6} height={sh - 6} fill="#ffffff" />
            <CountTx value={card.rating} from={40} delay={0.8} duration={700} x={0} y={-sh / 2 + 11 + 56 * 0.825} font={display(56)} color={INK} align="center" pop />
            <Tx s={c.sport} x={0} y={-sh / 2 + 11 + 47.6 + 9.7} font={sans(10)} color={INK} align="center" spacing={1.5} maxW={sw - 12} />
          </g>
        </g>
        {tags.map(([label, bg, fg], i) => {
          const w = measure(label, display(22)) + 20
          const top = 470 + i * (32.4 + 6)
          return (
            <g key={i} transform={`translate(${14 + w / 2} ${top + 16.2}) rotate(-3)`}>
              <g className="ftg-card-slap" style={at(0.95 + i * 0.15)}>
                <rect x={-w / 2} y={-16.2} width={w} height={32.4} fill={bg} />
                <Tx s={label} x={-w / 2 + 10} y={-16.2 + 3 + 22} font={display(22)} color={fg} />
              </g>
            </g>
          )
        })}
        <g className="ftg-card-up" style={at(0.55)}>
          <rect x={0} y={643.5} width={DW} height={DH - 643.5} fill={INK} />
          <Tx s={streak} x={383} y={668.2} font={sans(11)} color={MUTED} align="right" spacing={1.5} />
          <CountTx value={card.elo} delay={0.7} duration={800} format={(n) => `ELO ${n}`} x={383} y={697.3} font={display(26)} color={frame} align="right" />
          <Tx s={who} x={22} y={668.2} font={sans(whoPx)} color={MUTED} spacing={1.5} maxW={maxL} />
          <Tx s={court} x={22} y={697.3} font={display(cpx)} color="#ffffff" maxW={maxL} />
        </g>
      </Layer>
    </>
  )
}

// ── 3 · Scoreboard ─────────────────────────────────────────────────────────────────────────
function Scoreboard({ c }: { c: Ready }) {
  const clip = `${useId()}-p`
  const { card, labels: L, frame } = c
  const innerPanel = polyPath(26, 62, [[19, 0], [334, 0], [353, 19], [353, 116], [0, 116], [0, 19]])
  const name = c.names.join(' ')
  const namePx = fit(name, (px) => display(px), 36, 229, 16)
  const sub = [`@${card.user.username}`, card.sport?.name, fillLabel(L.levelShort, { n: card.level })].filter(Boolean).join(' · ')
  const subPx = fit(sub, (px) => sans(px, 700), 12, 229)
  const w1 = Math.max(measure(String(card.wins), display(96)), measure(L.winsLabel, sans(11), 2))
  const w2 = Math.max(measure(String(card.losses), display(96)), measure(L.lossesLabel, sans(11), 2))
  const wc = measure(':', display(44))
  const { x1, xc, x2 } = recordLayout(w1, w2, wc)
  const delta = card.elo_delta_30d
  const cells: [number, string, string, string][] = [
    [card.rating, L.rating, frame, MUTED],
    [card.elo, `ELO ${formatEloDelta(delta)}`, '#ffffff', delta > 0 ? '#3fd27a' : delta < 0 ? '#ff6b5a' : MUTED],
    [card.win_streak, L.streakLong, '#ffffff', MUTED],
  ]
  const top = 440.9
  const h = 698 - top
  const court = (card.king_of ?? card.home_court)?.name.toUpperCase() ?? '—'
  const cpx = fit(court, (px) => display(px), 28, 325, 14)
  const pinW = 78
  const pinH = 88

  return (
    <>
      <Layer>
        <rect width={DW} height={DH} fill="#0b0d10" />
        <Brand x={22} y={42} px={20} weight={900} className="ftg-card-fade" style={at(0.1)} />
        <Tx s={`${c.tier} · ${fillLabel(L.serial, { n: c.serial })}`} x={383} y={38} font={sans(11)} color={frame} align="right" spacing={2} className="ftg-card-fade" style={at(0.4)} />
        <path d={polyPath(22, 58, [[22, 0], [339, 0], [361, 22], [361, 120], [0, 120], [0, 22]])} fill={frame} />
        <path d={innerPanel} fill={INK} />
        <clipPath id={clip}>
          <path d={innerPanel} />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <Jersey n={c.number} right={385} y={base(44, 140, 0.8)} px={140} color={frame} alpha={0.3} />
        </g>
        <g className="ftg-card-pinin" style={{ transformOrigin: '81px 120px', ...at(0.15) }}>
          <path d={BOARD_PIN} transform={`translate(42 76) scale(${pinW / 64} ${pinH / 72})`} fill={frame} />
        </g>
      </Layer>

      <div
        className="ftg-card-pinin absolute"
        style={{ left: 42, top: 76, width: pinW, height: pinH, clipPath: `path('${scalePath(BOARD_PIN, pinW / 64, pinH / 72)}')`, transformOrigin: '39px 44px', ...at(0.15) }}
      >
        <Portrait c={c} cx={81} bottom={160} size={74} ox={42} oy={76} />
      </div>

      <Layer>
        <g clipPath={`url(#${clip})`}>
          <Tx s={name} x={134} y={127.15} font={display(namePx)} color="#ffffff" maxW={229} className="ftg-card-rise" style={at(0.25)} />
          <Tx s={sub} x={134} y={141.5} font={sans(subPx, 700)} color={MUTED} maxW={229} className="ftg-card-rise" style={at(0.38)} />
        </g>
        <Glint d="M24 178V80.5L44.5 60H360.5L381 80.5V178" />

        <rect x={22} y={190} width={361} height={151.8} fill="#262c36" />
        <rect x={24} y={192} width={357} height={147.8} fill={INK} />
        <svg x={24} y={192} width={357} height={147.8} viewBox="24 192 357 147.8" overflow="hidden">
          <g transform="translate(22 190)">
            <CourtLines color={frame} alpha={0.14} width={3} delay={0.2} items={[{ d: 'M180 0V170' }, { d: 'M0 40H46V130H0' }, { d: 'M361 40H315V130H361' }, { c: [180, 85, 42] }]} />
          </g>
        </svg>
        <Tx s={L.record} x={202.5} y={214.7} font={sans(11)} color={MUTED} align="center" spacing={2.5} className="ftg-card-fade" style={at(0.35)} />
        <CountTx value={card.wins} delay={0.45} duration={900} tick x={x1 + w1 / 2} y={303.3} font={display(96)} color={frame} align="center" />
        <Tx s={L.winsLabel} x={x1 + w1 / 2} y={321.2} font={sans(11)} color="#ffffff" align="center" spacing={2} className="ftg-card-fade" style={at(0.55)} />
        <Tx s=":" x={xc} y={289.15} font={display(44)} color="#4a525e" className="ftg-card-blink" />
        <CountTx value={card.losses} delay={0.45} duration={900} tick x={x2 + w2 / 2} y={303.3} font={display(96)} color="#ffffff" align="center" />
        <Tx s={L.lossesLabel} x={x2 + w2 / 2} y={321.2} font={sans(11)} color="#ffffff" align="center" spacing={2} className="ftg-card-fade" style={at(0.55)} />

        {cells.map(([v, label, vc, lc], i) => {
          const x = 22 + i * (115 + 8)
          const delay = 0.6 + i * 0.1
          return (
            <g key={i} className="ftg-card-rise" style={at(delay)}>
              <rect x={x} y={353.8} width={115} height={75.1} fill={INK} />
              <rect x={x} y={353.8} width={115} height={3} fill={i === 0 ? frame : '#262c36'} />
              <CountTx value={v} from={i === 0 ? 40 : 0} delay={delay} duration={700} pop={i === 0} x={x + 57.5} y={402.8} font={display(40)} color={vc} align="center" maxW={105} />
              <Tx s={label} x={x + 57.5} y={416.5} font={sans(10)} color={lc} align="center" spacing={1.5} maxW={105} />
            </g>
          )
        })}

        <g className="ftg-card-up" style={at(0.9)}>
          <path d={polyPath(22, top, [[0, 0], [361, 0], [361, h - 46], [180.5, h], [0, h - 46]])} fill={frame} />
          <g className="ftg-card-drop" style={at(1.2)}>
            {card.king_of ? (
              <path d={CROWN} transform={`translate(${202.5 - 14} ${top + 14}) scale(${28 / 24})`} fill="none" stroke={INK} strokeWidth={2.2 / (28 / 24)} strokeLinejoin="round" />
            ) : (
              <LogoPin cx={202.5} top={top + 14} w={24} frame={INK} hole={frame} />
            )}
          </g>
          <Tx s={card.king_of ? L.king : L.homeCourt} x={202.5} y={interBase(top + 44, 11)} font={sans(11)} color={INK} align="center" spacing={2} />
          <Tx s={court} x={202.5} y={top + 59.3 + 25.2} font={display(cpx)} color={INK} align="center" maxW={325} />
          <Tx s={`${L.beatMe} ${DOMAIN}`} x={202.5} y={interBase(top + 93.3, 12)} font={sans(12)} color={INK} align="center" maxW={325} />
        </g>
      </Layer>
    </>
  )
}

// ── 4 · Court pass ─────────────────────────────────────────────────────────────────────────
function useQrSvg(url: string): string | null {
  const [qr, setQr] = useState<{ url: string; src: string } | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: INK, light: '#ffffff' } })
      .then((svg) => alive && setQr({ url, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [url])
  return qr && qr.url === url ? qr.src : null
}

function Pass({ c }: { c: Ready }) {
  const clip = `${useId()}-s`
  const { card, labels: L, frame } = c
  const qr = useQrSvg(c.profileUrl)
  const inner = shieldPath(0, 0, 351, 618, 27, 90)
  const lines = c.names.slice(0, 2)
  const blockTop = lines.length > 1 ? 30.7 : 48
  const after = blockTop + 34.4 * lines.length
  const handle = `@${card.user.username} · ${fillLabel(L.serial, { n: c.serial })}`
  const hpx = fit(handle, (p) => sans(p, 700), 12, 185)
  const chipSports = [card.sport, ...card.sports.filter((s) => s.id !== card.sport?.id)].filter((s) => !!s).slice(0, 3)
  const chips: { label: string; x: number; w: number; first: boolean }[] = []
  let chipX = 144
  chipSports.forEach((s, i) => {
    const label = L.sportShort[s.slug] ?? s.name.toUpperCase()
    const w = measure(label, sans(11)) + 16
    if (chipX + w > 329) return
    chips.push({ label, x: chipX, w, first: i === 0 })
    chipX += w + 6
  })
  const stats: [number, string][] = [
    [card.rating, L.rating],
    [card.games, L.gamesLong],
    [card.elo, L.elo],
  ]
  const where = [card.home_court?.name, fillLabel(L.levelLong, { n: card.level })].filter(Boolean).join(' · ')
  const wpx = fit(where, (p) => sans(p, 700), 12, 307)
  const scanPx = fit(L.scan, (p) => display(p), 30, 307, 16)
  const link = c.profileUrl.replace(/^https?:\/\//, '')
  const lpx = fit(link, (p) => sans(p), 12, 307)

  return (
    <>
      <Layer>
        <rect width={DW} height={DH} fill={INK} />
        <Brand x={22} y={44} px={20} weight={900} className="ftg-card-fade" style={at(0.1)} />
        <Tx s={fillLabel(L.pass, { tier: c.tier })} x={383} y={40} font={sans(11)} color={frame} align="right" spacing={2} className="ftg-card-fade" style={at(0.4)} />
        <path d={shieldPath(22, 60, 361, 628, 30, 92)} fill={frame} />
        <g transform="translate(27 65)">
          <path d={inner} fill="#f6f3ee" />
          <clipPath id={clip}>
            <path d={inner} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <CourtLines color={INK} alpha={0.08} width={3} items={[{ c: [175, -30, 210] }, { d: 'M115 0V140H235V0' }, { c: [175, 140, 56] }]} />
          </g>
        </g>
      </Layer>

      <div className="ftg-card-pinin absolute" style={{ left: 49, top: 89, width: 108, height: 128, clipPath: `path('${PASS_PIN}')`, background: INK, transformOrigin: '50% 45%', ...at(0.2) }}>
        <Portrait c={c} cx={27 + 76} bottom={65 + 146} size={112} ox={49} oy={89} />
      </div>

      <Layer>
        <g transform="translate(27 65)" clipPath={`url(#${clip})`}>
          {lines.map((line, i) => {
            const px = fit(line, (p) => display(p), 40, 185, 16)
            return <Tx key={i} s={line} x={144} y={blockTop + 34.4 * i + 40 * 0.83} font={display(px)} color={INK} maxW={185} className="ftg-card-rise" style={at(0.3 + i * 0.1)} />
          })}
          <Tx s={handle} x={144} y={after + 4 + 11.6} font={sans(hpx, 700)} color="#5b6470" maxW={185} className="ftg-card-rise" style={at(0.5)} />
          {chips.map((ch, i) => (
            <g key={ch.label} className="ftg-card-slap" style={at(0.6 + i * 0.08)}>
              <rect x={ch.x} y={after + 24.5} width={ch.w} height={21.3} rx={10.65} fill={ch.first ? frame : INK} />
              <Tx s={ch.label} x={ch.x + 8} y={after + 24.5 + 4 + 10.66} font={sans(11)} color={ch.first ? INK : '#ffffff'} />
            </g>
          ))}
          {stats.map(([v, label], i) => {
            const x = 22 + i * (97 + 8)
            const delay = 0.55 + i * 0.08
            return (
              <g key={i} className="ftg-card-rise" style={at(delay)}>
                <rect x={x} y={172} width={97} height={68.1} fill={INK} />
                {i > 0 && <rect x={x + 2} y={174} width={93} height={64.1} fill="#ffffff" />}
                <CountTx value={v} from={i === 0 ? 40 : 0} delay={delay} duration={700} pop={i === 0} x={x + 48.5} y={214.4} font={display(36)} color={i === 0 ? frame : INK} align="center" maxW={89} />
                <Tx s={label} x={x + 48.5} y={227.7} font={sans(10)} color={i === 0 ? '#ffffff' : '#5b6470'} align="center" spacing={1.5} maxW={89} />
              </g>
            )
          })}
          <Tx s={where} x={175.5} y={interBase(262, 12)} font={sans(wpx, 700)} color="#5b6470" align="center" maxW={307} className="ftg-card-fade" style={at(0.8)} />

          {/* Perforation: the notches punch in, the dashed tear line runs across. */}
          <g className="ftg-card-fade" style={at(0.85)}>
            <circle cx={0} cy={314} r={18} fill={INK} />
            <circle cx={351} cy={314} r={18} fill={INK} />
          </g>
          <line x1={18} y1={314} x2={333} y2={314} stroke="#c9c3b8" strokeWidth={3} strokeDasharray="9 6" className="ftg-card-tear" style={at(0.9)} />

          <g className="ftg-card-stub" style={at(0.95)}>
            <Tx s={L.scan} x={175.5} y={338 + scanPx * 0.9} font={display(scanPx)} color={INK} align="center" maxW={307} />
            <rect x={98.5} y={376} width={154} height={154} fill={INK} />
            <rect x={101.5} y={379} width={148} height={148} fill="#ffffff" />
            {qr && <image href={qr} x={109.5} y={387} width={132} height={132} className="ftg-card-fade" style={at(1.15)} />}
            <Tx s={link} x={175.5} y={interBase(538, 12)} font={sans(lpx)} color={INK} align="center" maxW={307} />
          </g>
          <g className="ftg-card-drop" style={at(1.25)}>
            <LogoPin cx={175.5} top={560} w={24} frame={frame} hole="#f6f3ee" />
          </g>
        </g>
        <Glint d={shieldPath(24.5, 62.5, 356, 623, 28.5, 91)} />
      </Layer>
    </>
  )
}

// ── The card ───────────────────────────────────────────────────────────────────────────────
/** The live, animated player card, scaled to fill its (9:16) box. */
export function PlayerCardLive(props: PlayerCardLiveProps) {
  const { card, labels, avatar, style, className = '' } = props
  const fonts = useCardFonts()
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / DW))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const c: Ready = {
    ...props,
    frame: tierColor(card.tier),
    tier: labels.tiers[card.tier] ?? card.tier.toUpperCase(),
    sport: card.sport ? (labels.sportShort[card.sport.slug] ?? card.sport.name.toUpperCase()) : '',
    serial: formatSerial(card.serial),
    number: avatar ? kitOf(avatar).number || null : null,
  }

  return (
    <div ref={boxRef} className={`relative h-full w-full overflow-hidden ${className}`} role="img" aria-label={labels.preview}>
      {fonts && scale > 0 && (
        <div className="absolute left-0 top-0 origin-top-left select-none" style={{ width: DW, height: DH, transform: `scale(${scale})` }}>
          {style === 'poster' ? <Poster c={c} /> : style === 'scoreboard' ? <Scoreboard c={c} /> : style === 'pass' ? <Pass c={c} /> : <TradingCard c={c} />}
        </div>
      )}
    </div>
  )
}
