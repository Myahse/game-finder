import type { ReactNode } from 'react'
import type { PlayerAvatarConfig } from '../../schema'
import { armJoints, CX, type Geo, kitOf, legX, type Skin, Y } from './geometry'
import { mix, shade } from './palette'

type Pt = readonly [number, number]
type Body = Geo & { curvy: boolean }

const SLEEVELESS = new Set(['top_basketball_jersey', 'top_tank', 'top_running_shirt'])
const LONG_SLEEVE = new Set(['top_compression', 'top_hoodie'])
const TATTOO_INK = '#2b2d42'

function along(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function limb(points: readonly Pt[]) {
  return `M ${points.map((p) => p.join(',')).join(' L ')}`
}

const outlineOf = (hex: string) => shade(hex, 0.38)

/** A rounded limb with outline, core shadow on the far side and a soft highlight (light from upper left). */
function Limb({ points, width, color, cap = 'round' }: { points: readonly Pt[]; width: number; color: string; cap?: 'round' | 'butt' }) {
  const d = limb(points)
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={outlineOf(color)} strokeWidth={width + 2.2} strokeLinecap={cap} />
      <path d={d} stroke={color} strokeWidth={width} strokeLinecap={cap} />
      <path d={d} stroke={shade(color, 0.16)} strokeWidth={width * 0.34} strokeLinecap={cap} transform={`translate(${width * 0.27} 0)`} opacity={0.75} />
      <path d={d} stroke={shade(color, -0.22)} strokeWidth={width * 0.16} strokeLinecap={cap} transform={`translate(${-width * 0.24} 0)`} opacity={0.55} />
    </g>
  )
}

/** Hand with a thumb, oriented along the forearm. */
function Hand({ elbow, wrist, width, skin, side }: { elbow: Pt; wrist: Pt; width: number; skin: Skin; side: -1 | 1 }) {
  const dx = wrist[0] - elbow[0]
  const dy = wrist[1] - elbow[1]
  const len = Math.hypot(dx, dy) || 1
  const r = width * 0.55
  const cx = wrist[0] + (dx / len) * r * 0.85
  const cy = wrist[1] + (dy / len) * r * 0.85
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 90
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <ellipse
        cx={cx - side * r * 0.62}
        cy={cy - r * 0.15}
        rx={r * 0.32}
        ry={r * 0.6}
        fill={skin.base}
        stroke={outlineOf(skin.base)}
        strokeWidth={1}
        transform={`rotate(${side * 18} ${cx} ${cy})`}
      />
      <ellipse cx={cx} cy={cy} rx={r * 0.82} ry={r * 1.02} fill={skin.base} stroke={outlineOf(skin.base)} strokeWidth={1.1} />
      <path d={`M ${cx - r * 0.35},${cy + r * 0.55} Q ${cx},${cy + r * 0.8} ${cx + r * 0.35},${cy + r * 0.55}`} stroke={skin.shadow} strokeWidth={0.8} fill="none" opacity={0.6} />
    </g>
  )
}

function torsoPath(g: Body, inset: number, bottom: number = Y.waist + 2) {
  const L = CX - g.shoulder + inset
  const R = CX + g.shoulder - inset
  const n = g.neck + 4
  // Curvy: chest sits a little forward, waist nips in.
  const chest = g.curvy ? 3 : 0
  return `M ${CX - n},${Y.shoulder - 6}
    L ${L + 6},${Y.shoulder - 2} Q ${L},${Y.shoulder} ${L},${Y.shoulder + 9}
    C ${L - chest},${Y.shoulder + 40} ${CX - g.waist - 4},${Y.waist - 30} ${CX - g.waist},${bottom}
    L ${CX + g.waist},${bottom}
    C ${CX + g.waist + 4},${Y.waist - 30} ${R + chest},${Y.shoulder + 40} ${R},${Y.shoulder + 9}
    Q ${R},${Y.shoulder} ${R - 6},${Y.shoulder - 2}
    L ${CX + n},${Y.shoulder - 6} Q ${CX},${Y.shoulder + 2} ${CX - n},${Y.shoulder - 6} Z`
}

/** Legs, socks and shoes. */
export function Legs({ c, g, skin }: { c: PlayerAvatarConfig; g: Body; skin: Skin }) {
  const kit = kitOf(c)
  const longSocks = c.shoes === 'shoes_football'
  const highTop = c.shoes === 'shoes_basketball'
  const shoe =
    {
      shoes_basketball: { body: '#f7f6f2', accent: kit.accent, sole: '#1d1f2b' },
      shoes_football: { body: '#1d1f2b', accent: kit.main === '#109c4e' ? '#c6f135' : kit.accent, sole: '#1d1f2b' },
      shoes_tennis: { body: '#ffffff', accent: kit.accent, sole: '#d9d4c7' },
      shoes_running: { body: kit.main, accent: '#ffffff', sole: '#f4f1ea' },
      shoes_badminton: { body: '#f2f1ec', accent: kit.accent, sole: '#b9884f' },
      shoes_sneakers: { body: '#f4f2ed', accent: '#2a2c33', sole: '#f4f2ed' },
    }[c.shoes] ?? { body: '#f4f2ed', accent: '#2a2c33', sole: '#f4f2ed' }

  return (
    <g>
      {([-1, 1] as const).map((side) => {
        const x = legX(g, side)
        const foot = x + side * 3
        const pts: Pt[] = [
          [x, Y.waist],
          [x + side * 1, Y.knee],
          [foot, Y.ankle],
        ]
        return (
          <g key={side}>
            <Limb points={pts} width={g.leg} color={skin.base} />
            <path d={`M ${x + side - 3},${Y.knee - 2} q 3,3 6,0`} stroke={skin.shadow} strokeWidth={1} fill="none" opacity={0.55} />
            {longSocks ? (
              <>
                <Limb
                  points={[
                    [x + side * 1, Y.knee + 6],
                    [foot, Y.ankle],
                  ]}
                  width={g.leg + 1.5}
                  color={kit.main}
                  cap="butt"
                />
                <path
                  d={limb([
                    [x + side * 1.3, Y.knee + 10],
                    [x + side * 1.5, Y.knee + 15],
                  ])}
                  stroke={kit.trim}
                  strokeWidth={g.leg + 1.6}
                  fill="none"
                />
              </>
            ) : (
              <Limb
                points={[
                  [foot, Y.ankle - (highTop ? 18 : 9)],
                  [foot, Y.ankle],
                ]}
                width={g.leg}
                color="#f7f6f2"
                cap="butt"
              />
            )}
            <Shoe x={foot} side={side} highTop={highTop} colors={shoe} studs={c.shoes === 'shoes_football'} />
          </g>
        )
      })}
    </g>
  )
}

function Shoe({ x, side, highTop, colors, studs }: { x: number; side: -1 | 1; highTop: boolean; colors: { body: string; accent: string; sole: string }; studs: boolean }) {
  const top = highTop ? Y.ankle - 12 : Y.ankle - 3
  const toe = x + side * 15
  const heel = x - side * 9
  return (
    <g>
      <path
        d={`M ${heel},${top} L ${x + side * 6},${top} Q ${x + side * 9},${Y.ankle + 6} ${toe},${Y.ankle + 10}
          Q ${toe + side * 3},${Y.ankle + 13} ${toe + side * 2},${Y.sole - 4} L ${heel - side * 1},${Y.sole - 4}
          Q ${heel - side * 3},${Y.ankle + 6} ${heel},${top} Z`}
        fill={colors.body}
        stroke={outlineOf(colors.body)}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* laces */}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${x + side * (1 + i * 2.6)},${Y.ankle + 1 + i * 2.2} l ${side * 3.4},-1.6`} stroke={shade(colors.body, 0.3)} strokeWidth={1} strokeLinecap="round" />
      ))}
      <path d={`M ${heel + side * 2},${Y.ankle + 9} Q ${x + side * 6},${Y.ankle + 11} ${toe - side * 2},${Y.ankle + 7}`} stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <path d={`M ${toe - side * 4},${Y.ankle + 8} q ${side * 4},1 ${side * 5},4`} stroke={shade(colors.body, -0.5)} strokeWidth={1.2} fill="none" opacity={0.7} />
      <rect
        x={Math.min(heel, toe + side * 2) - 1}
        y={Y.sole - 5}
        width={Math.abs(toe + side * 2 - heel) + 2}
        height={5}
        rx={2.5}
        fill={colors.sole}
        stroke={outlineOf(colors.sole)}
        strokeWidth={0.8}
      />
      {studs && [0.15, 0.5, 0.85].map((t) => <rect key={t} x={heel + (toe - heel) * t - 1.5} y={Y.sole - 0.5} width={3} height={3} rx={1} fill="#9aa0a8" />)}
    </g>
  )
}

/** Shorts, pants, leggings or skirt. */
export function Bottoms({ c, g }: { c: PlayerAvatarConfig; g: Body }) {
  const kit = kitOf(c)
  const white = kit.main === '#f6f5f0' || kit.main === '#f4f4ef'
  if (c.bottom === 'bottom_tennis_skirt') {
    const fill = white ? '#f6f5f0' : kit.main
    const hem = 266
    const flare = g.hip + 17
    return (
      <g>
        <path
          d={`M ${CX - g.waist - 1},${Y.waist - 4} L ${CX + g.waist + 1},${Y.waist - 4} Q ${CX + flare - 4},${Y.waist + 22} ${CX + flare},${hem} Q ${CX},${hem + 5} ${CX - flare},${hem} Q ${CX - flare + 4},${Y.waist + 22} ${CX - g.waist - 1},${Y.waist - 4} Z`}
          fill={fill}
          stroke={outlineOf(fill)}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
        {[-0.66, -0.33, 0, 0.33, 0.66].map((t) => (
          <path key={t} d={`M ${CX + t * g.waist},${Y.waist + 2} L ${CX + t * flare * 0.95},${hem + 1.5 - Math.abs(t) * 2}`} stroke={shade(fill, 0.12)} strokeWidth={1.1} />
        ))}
        <path d={`M ${CX - flare + 1},${hem - 3} Q ${CX},${hem + 2} ${CX + flare - 1},${hem - 3}`} stroke={kit.trim} strokeWidth={2.4} fill="none" />
        <rect x={CX - g.waist - 1} y={Y.waist - 5} width={2 * g.waist + 2} height={7} rx={2} fill={shade(fill, 0.1)} />
      </g>
    )
  }

  const spec =
    {
      bottom_basketball_shorts: { bot: 296, flare: 7, fill: kit.main, trim: kit.trim, tight: false },
      bottom_football_shorts: { bot: 262, flare: 4, fill: kit.trim === '#f4f4ef' ? '#f4f4ef' : '#1d1f2b', trim: kit.main, tight: false },
      bottom_tennis_shorts: { bot: 266, flare: 4, fill: '#f6f5f0', trim: kit.accent, tight: false },
      bottom_running_shorts: { bot: 250, flare: 3, fill: '#1d1f2b', trim: kit.accent, tight: false },
      bottom_sweatpants: { bot: Y.ankle - 4, flare: 2, fill: '#8d929b', trim: '#7a7f88', tight: false },
      bottom_athletic_pants: { bot: Y.ankle - 6, flare: 1, fill: '#22252c', trim: kit.accent, tight: false },
      bottom_leggings: { bot: Y.ankle - 7, flare: -1, fill: '#1d1f2b', trim: kit.accent, tight: true },
    }[c.bottom] ?? { bot: 266, flare: 4, fill: '#1d1f2b', trim: kit.accent, tight: false }
  const long = spec.bot > 300
  const outer = (side: -1 | 1, y: number) => legX(g, side) + side * (g.leg / 2 + spec.flare * (long ? 0.3 : 1) + (y < Y.crotch ? (spec.tight ? 1 : 2) : 0))
  const inner = (side: -1 | 1) => legX(g, side) - side * (g.leg / 2 + (spec.tight ? 0 : long ? 1.5 : 3))
  const hipY = Y.waist + 22
  const crotch = Math.min(Y.crotch, spec.bot - 8)
  const d = `M ${CX - g.waist - 1},${Y.waist - 4} L ${CX + g.waist + 1},${Y.waist - 4}
    Q ${outer(1, hipY) + 1},${Y.waist + 4} ${outer(1, hipY)},${hipY} L ${outer(1, spec.bot)},${spec.bot} L ${inner(1)},${spec.bot}
    L ${CX},${crotch} L ${inner(-1)},${spec.bot} L ${outer(-1, spec.bot)},${spec.bot}
    L ${outer(-1, hipY)},${hipY} Q ${outer(-1, hipY) - 1},${Y.waist + 4} ${CX - g.waist - 1},${Y.waist - 4} Z`
  return (
    <g>
      <path d={d} fill={spec.fill} stroke={outlineOf(spec.fill)} strokeWidth={1.1} strokeLinejoin="round" />
      {/* shading + folds */}
      <path d={`M ${outer(1, hipY) - 4},${hipY + 2} L ${outer(1, spec.bot) - 4},${spec.bot - 2}`} stroke={shade(spec.fill, 0.14)} strokeWidth={5} opacity={0.6} />
      {!spec.tight && <path d={`M ${CX - 6},${crotch - 14} q 4,6 2,12 M ${CX + 8},${crotch - 12} q -3,5 -1,10`} stroke={shade(spec.fill, 0.2)} strokeWidth={1} fill="none" />}
      <rect x={CX - g.waist - 1} y={Y.waist - 5} width={2 * g.waist + 2} height={7} rx={2} fill={shade(spec.fill, 0.12)} />
      {([-1, 1] as const).map((side) => (
        <path key={side} d={`M ${outer(side, hipY)},${hipY + 2} L ${outer(side, spec.bot) - side * 1.2},${spec.bot - 1}`} stroke={spec.trim} strokeWidth={3} />
      ))}
      {c.bottom === 'bottom_sweatpants' &&
        ([-1, 1] as const).map((side) => <rect key={side} x={legX(g, side) - g.leg / 2 - 1} y={Y.ankle - 9} width={g.leg + 2} height={6} rx={3} fill={spec.trim} />)}
      {c.bottom === 'bottom_sweatpants' && <path d={`M ${CX - 3},${Y.waist - 1} l -2,10 M ${CX + 3},${Y.waist - 1} l 2,10`} stroke="#f4f4ef" strokeWidth={1.4} strokeLinecap="round" />}
    </g>
  )
}

/** Bare arms (skin) and hands — sleeves are drawn on top by <Top>. */
export function Arms({ g, skin, raised }: { g: Body; skin: Skin; raised: boolean }) {
  return (
    <g>
      {([-1, 1] as const).map((side) => {
        const j = armJoints(g, side, raised && side === -1)
        return (
          <g key={side}>
            <Limb points={[j.shoulder, j.elbow, j.wrist]} width={g.arm} color={skin.base} />
            <Hand elbow={j.elbow} wrist={j.wrist} width={g.arm} skin={skin} side={side} />
          </g>
        )
      })}
    </g>
  )
}

/** Ink on the arms (drawn under sleeves). */
export function Tattoos({ c, g, raised }: { c: PlayerAvatarConfig; g: Body; raised: boolean }) {
  const details = c.details ?? []
  const out: ReactNode[] = []
  if (details.includes('tattoo_arm')) {
    const j = armJoints(g, 1, false)
    const a = along(j.shoulder, j.elbow, 0.66)
    const b = along(j.shoulder, j.elbow, 0.82)
    const w = g.arm / 2
    const h = b[1] - a[1] - 3
    out.push(
      <g key="band" stroke={TATTOO_INK} strokeWidth={1.3} fill="none" opacity={0.8} strokeLinejoin="round">
        <path d={`M ${a[0] - w},${a[1]} L ${a[0] + w},${a[1] + 1}`} />
        <path d={`M ${b[0] - w},${b[1]} L ${b[0] + w},${b[1] + 1}`} />
        <path d={`M ${a[0] - w + 1},${a[1] + 1.5} l 2.4,${h} l 2.4,${-h} l 2.4,${h} l 2.4,${-h} l 2.4,${h} l 2.4,${-h}`} />
      </g>,
    )
  }
  if (details.includes('tattoo_sleeve')) {
    const j = armJoints(g, -1, raised)
    const marks = [0.18, 0.38, 0.58, 0.78].flatMap((t) => [along(j.shoulder, j.elbow, t), along(j.elbow, j.wrist, t * 0.9)])
    out.push(
      <g key="sleeve" stroke={TATTOO_INK} strokeWidth={1.2} fill="none" opacity={0.75}>
        {marks.map((p, i) =>
          i % 2 ? <path key={i} d={`M ${p[0] - 3},${p[1]} l 3,-3.5 l 3,3.5 l -3,3.5 Z`} /> : <path key={i} d={`M ${p[0] - g.arm * 0.38},${p[1] - 2} q ${g.arm * 0.38},5 ${g.arm * 0.76},0`} />,
        )}
      </g>,
    )
  }
  return out.length ? <g>{out}</g> : null
}

/** Top garment, collar, number and sleeves. */
export function Top({ c, g, raised, skin }: { c: PlayerAvatarConfig; g: Body; raised: boolean; skin: Skin }) {
  const kit = kitOf(c)
  if (c.top === 'top_sports_bra') return <SportsBra c={c} g={g} skin={skin} />

  const col =
    {
      top_tee: { main: '#efece4', trim: kit.accent, ink: kit.accent },
      top_hoodie: { main: '#2c3038', trim: '#3c414b', ink: kit.accent },
      top_compression: { main: '#1c1e23', trim: kit.accent, ink: kit.accent },
      top_tennis_shirt: { main: '#f6f5f0', trim: kit.accent, ink: kit.accent },
    }[c.top] ?? { main: kit.main, trim: kit.trim, ink: kit.ink }

  const sleeveless = SLEEVELESS.has(c.top)
  const longSleeve = LONG_SLEEVE.has(c.top)
  const inset = c.top === 'top_running_shirt' ? 12 : sleeveless ? 8 : 0
  const outline = outlineOf(col.main)

  const sleeve = (side: -1 | 1) => {
    if (sleeveless) return null
    const j = armJoints(g, side, raised && side === -1)
    const to = longSleeve ? j.wrist : along(j.shoulder, j.elbow, 0.55)
    const pts = longSleeve ? [j.shoulder, j.elbow, to] : [j.shoulder, to]
    return (
      <g key={side}>
        <Limb points={pts} width={g.arm + 5} color={col.main} />
        {!longSleeve && <path d={limb([along(j.shoulder, to, 0.8), to])} stroke={col.trim} strokeWidth={g.arm + 5} fill="none" />}
        {longSleeve && <path d={limb([along(j.elbow, to, 0.86), to])} stroke={c.top === 'top_hoodie' ? col.trim : shade(col.main, 0.15)} strokeWidth={g.arm + 5} fill="none" />}
      </g>
    )
  }

  return (
    <g>
      {c.top === 'top_hoodie' && (
        <path
          d={`M ${CX - g.neck - 14},${Y.shoulder - 4} Q ${CX},${Y.shoulder - 26} ${CX + g.neck + 14},${Y.shoulder - 4} Q ${CX},${Y.shoulder + 4} ${CX - g.neck - 14},${Y.shoulder - 4} Z`}
          fill={shade(col.main, 0.15)}
          stroke={outline}
          strokeWidth={1}
        />
      )}
      <path d={torsoPath(g, inset)} fill={col.main} stroke={outline} strokeWidth={1.2} strokeLinejoin="round" />
      {/* light + shadow modelling */}
      <path
        d={`M ${CX + g.shoulder - inset - 4},${Y.shoulder + 14} C ${CX + g.shoulder - inset - 6},${Y.shoulder + 50} ${CX + g.waist + 2},${Y.waist - 30} ${CX + g.waist - 4},${Y.waist}`}
        stroke={shade(col.main, 0.12)}
        strokeWidth={9}
        fill="none"
        opacity={0.55}
      />
      <path
        d={`M ${CX - g.shoulder + inset + 8},${Y.shoulder + 16} Q ${CX - g.shoulder + inset + 6},${Y.shoulder + 34} ${CX - g.waist + 4},${Y.waist - 40}`}
        stroke={shade(col.main, -0.18)}
        strokeWidth={5}
        fill="none"
        opacity={0.45}
      />
      {/* chest + fabric folds */}
      {g.curvy && (
        <path
          d={`M ${CX - g.shoulder + inset + 10},${Y.shoulder + 38} Q ${CX - 9},${Y.shoulder + 46} ${CX - 2},${Y.shoulder + 38} M ${CX + 2},${Y.shoulder + 38} Q ${CX + 9},${Y.shoulder + 46} ${CX + g.shoulder - inset - 10},${Y.shoulder + 38}`}
          stroke={shade(col.main, 0.16)}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
        />
      )}
      <path
        d={`M ${CX - g.waist + 6},${Y.waist - 12} q 6,-3 10,1 M ${CX + g.waist - 8},${Y.waist - 16} q -5,-2 -9,2`}
        stroke={shade(col.main, 0.18)}
        strokeWidth={1.1}
        fill="none"
        strokeLinecap="round"
      />

      {/* collars */}
      {(c.top === 'top_basketball_jersey' || c.top === 'top_tank' || c.top === 'top_running_shirt') && (
        <path d={`M ${CX - g.neck - 4},${Y.shoulder - 5} Q ${CX},${Y.shoulder + 22} ${CX + g.neck + 4},${Y.shoulder - 5}`} stroke={col.trim} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      )}
      {c.top === 'top_basketball_jersey' &&
        ([-1, 1] as const).map((side) => (
          <path
            key={side}
            d={`M ${CX + side * (g.neck + 5)},${Y.shoulder - 5} L ${CX + side * (g.shoulder - inset - 3)},${Y.shoulder - 1} Q ${CX + side * (g.shoulder - inset)},${Y.shoulder + 30} ${CX + side * (g.shoulder - inset + 1)},${Y.shoulder + 44}`}
            stroke={col.trim}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      {c.top === 'top_football_jersey' && (
        <path d={`M ${CX - g.neck - 4},${Y.shoulder - 5} L ${CX},${Y.shoulder + 12} L ${CX + g.neck + 4},${Y.shoulder - 5}`} stroke={col.trim} strokeWidth={3.4} fill="none" strokeLinejoin="round" />
      )}
      {(c.top === 'top_tee' || c.top === 'top_badminton_shirt' || c.top === 'top_compression' || c.top === 'top_hoodie') && (
        <path d={`M ${CX - g.neck - 3},${Y.shoulder - 5} Q ${CX},${Y.shoulder + 6} ${CX + g.neck + 3},${Y.shoulder - 5}`} stroke={shade(col.main, 0.22)} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      )}
      {c.top === 'top_tennis_shirt' && (
        <g>
          <path
            d={`M ${CX - g.neck - 5},${Y.shoulder - 6} L ${CX - 2},${Y.shoulder + 6} L ${CX - g.neck - 9},${Y.shoulder + 4} Z M ${CX + g.neck + 5},${Y.shoulder - 6} L ${CX + 2},${Y.shoulder + 6} L ${CX + g.neck + 9},${Y.shoulder + 4} Z`}
            fill={col.main}
            stroke={shade(col.main, 0.25)}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <path d={`M ${CX},${Y.shoulder + 6} L ${CX},${Y.shoulder + 22}`} stroke={shade(col.main, 0.25)} strokeWidth={1} />
          <circle cx={CX} cy={Y.shoulder + 12} r={1.2} fill={shade(col.main, 0.3)} />
          <circle cx={CX} cy={Y.shoulder + 18} r={1.2} fill={shade(col.main, 0.3)} />
          <path d={`M ${CX - g.shoulder + 4},${Y.shoulder + 40} L ${CX + g.shoulder - 4},${Y.shoulder + 40}`} stroke={col.trim} strokeWidth={4} opacity={0.9} />
        </g>
      )}
      {c.top === 'top_badminton_shirt' &&
        ([-1, 1] as const).map((side) => (
          <path
            key={side}
            d={`M ${CX + side * (g.shoulder - 4)},${Y.shoulder + 12} C ${CX + side * (g.shoulder - 8)},${Y.shoulder + 50} ${CX + side * (g.waist + 1)},${Y.waist - 30} ${CX + side * (g.waist - 2)},${Y.waist}`}
            stroke={kit.trim}
            strokeWidth={5}
            fill="none"
          />
        ))}
      {c.top === 'top_compression' &&
        ([-1, 1] as const).map((side) => (
          <path
            key={side}
            d={`M ${CX + side * 6},${Y.shoulder + 10} C ${CX + side * 16},${Y.shoulder + 40} ${CX + side * 10},${Y.waist - 40} ${CX + side * 12},${Y.waist}`}
            stroke={col.trim}
            strokeWidth={1.4}
            fill="none"
            opacity={0.8}
          />
        ))}
      {c.top === 'top_hoodie' && (
        <g>
          <path d={`M ${CX - 4},${Y.shoulder + 2} l -2,22 M ${CX + 4},${Y.shoulder + 2} l 2,22`} stroke="#e8e6e0" strokeWidth={1.5} strokeLinecap="round" />
          <path
            d={`M ${CX - 20},${Y.waist - 34} L ${CX + 20},${Y.waist - 34} L ${CX + 24},${Y.waist - 10} L ${CX - 24},${Y.waist - 10} Z`}
            fill={shade(col.main, 0.1)}
            stroke={outline}
            strokeWidth={0.8}
          />
          <rect x={CX - g.waist} y={Y.waist - 6} width={2 * g.waist} height={8} rx={3} fill={col.trim} />
        </g>
      )}
      {/* chest number / logo */}
      {(c.top === 'top_basketball_jersey' || c.top === 'top_football_jersey' || c.top === 'top_tank' || c.top === 'top_badminton_shirt') && kit.number && (
        <text
          x={CX}
          y={Y.shoulder + 58}
          textAnchor="middle"
          fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
          fontWeight={800}
          fontSize={30}
          fill={col.ink}
          stroke={c.top === 'top_tank' ? 'none' : shade(col.trim, 0.1)}
          strokeWidth={1}
          paintOrder="stroke"
        >
          {kit.number}
        </text>
      )}
      {(c.top === 'top_tee' || c.top === 'top_running_shirt' || c.top === 'top_compression') && (
        <path d={`M ${CX + 12},${Y.shoulder + 26} l 6,-6 l 4,4 l 8,-9`} stroke={col.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {sleeve(-1)}
      {sleeve(1)}
    </g>
  )
}

/** Sports bra over a bare midriff. */
function SportsBra({ c, g, skin }: { c: PlayerAvatarConfig; g: Body; skin: Skin }) {
  const kit = kitOf(c)
  const braBottom = Y.shoulder + 50
  const L = CX - g.shoulder + 9
  const R = CX + g.shoulder - 9
  return (
    <g>
      <path d={torsoPath(g, 6)} fill={skin.base} stroke={outlineOf(skin.base)} strokeWidth={1.1} strokeLinejoin="round" />
      <path
        d={`M ${CX + g.waist - 3},${braBottom + 6} C ${CX + g.waist + 2},${Y.waist - 30} ${CX + g.waist},${Y.waist - 10} ${CX + g.waist - 3},${Y.waist}`}
        stroke={skin.shadow}
        strokeWidth={6}
        fill="none"
        opacity={0.35}
      />
      {/* subtle core definition + navel */}
      <path d={`M ${CX},${braBottom + 10} L ${CX},${Y.waist - 22}`} stroke={skin.shadow} strokeWidth={1} opacity={0.4} />
      <ellipse cx={CX} cy={Y.waist - 16} rx={1.3} ry={2} fill={skin.shadow} opacity={0.7} />
      {/* blend the shoulders into the torso */}
      {([-1, 1] as const).map((side) => (
        <ellipse key={side} cx={CX + side * (g.shoulder - 9)} cy={Y.shoulder + 8} rx={6} ry={8} fill={mix(skin.base, skin.highlight, 0.15)} opacity={0.9} />
      ))}
      <path
        d={`M ${L},${Y.shoulder + 6} Q ${CX},${Y.shoulder + 26} ${R},${Y.shoulder + 6} L ${R + 2},${braBottom - 6} Q ${CX},${braBottom + 2} ${L - 2},${braBottom - 6} Z`}
        fill={kit.main}
        stroke={outlineOf(kit.main)}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path d={`M ${L - 1},${braBottom - 7} Q ${CX},${braBottom + 1} ${R + 1},${braBottom - 7}`} stroke={kit.trim} strokeWidth={4} fill="none" />
      <path d={`M ${CX - g.neck - 2},${Y.shoulder - 5} L ${L + 3},${Y.shoulder + 8} M ${CX + g.neck + 2},${Y.shoulder - 5} L ${R - 3},${Y.shoulder + 8}`} stroke={kit.main} strokeWidth={4.5} strokeLinecap="round" />
      <path
        d={`M ${CX - 12},${Y.shoulder + 30} Q ${CX - 6},${Y.shoulder + 36} ${CX - 1},${Y.shoulder + 30} M ${CX + 1},${Y.shoulder + 30} Q ${CX + 6},${Y.shoulder + 36} ${CX + 12},${Y.shoulder + 30}`}
        stroke={shade(kit.main, 0.18)}
        strokeWidth={1.2}
        fill="none"
      />
    </g>
  )
}

export function Neck({ g, skin }: { g: Body; skin: Skin }) {
  return (
    <g>
      <rect x={CX - g.neck} y={Y.neckTop} width={2 * g.neck} height={Y.shoulder - Y.neckTop + 2} rx={g.neck * 0.6} fill={skin.base} stroke={outlineOf(skin.base)} strokeWidth={1} />
      <path d={`M ${CX - g.neck},${Y.neckTop + 6} Q ${CX},${Y.neckTop + 18} ${CX + g.neck},${Y.neckTop + 6} L ${CX + g.neck},${Y.neckTop} L ${CX - g.neck},${Y.neckTop} Z`} fill={skin.shadow} opacity={0.55} />
      <path d={`M ${CX + g.neck * 0.45},${Y.neckTop + 10} L ${CX + g.neck * 0.45},${Y.shoulder - 4}`} stroke={skin.shadow} strokeWidth={g.neck * 0.5} opacity={0.25} strokeLinecap="round" />
    </g>
  )
}
