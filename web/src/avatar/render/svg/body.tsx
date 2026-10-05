import type { PlayerAvatarConfig } from '../../schema'
import { armJoints, CX, type Geo, legX, type Skin, Y } from './geometry'
import { KITS, shade } from './palette'

const SLEEVELESS = new Set(['top_basketball_jersey', 'top_tank', 'top_running_shirt'])
const LONG_SLEEVE = new Set(['top_compression', 'top_hoodie'])

function topColors(c: PlayerAvatarConfig) {
  const kit = KITS[c.sport] ?? KITS.basketball
  switch (c.top) {
    case 'top_tee':
      return { main: '#efece4', trim: kit.main, ink: kit.main }
    case 'top_hoodie':
      return { main: '#2c3038', trim: '#3c414b', ink: kit.main }
    case 'top_compression':
      return { main: '#1c1e23', trim: kit.main, ink: kit.main }
    case 'top_tennis_shirt':
      return { main: '#f6f5f0', trim: kit.main === '#f6f5f0' ? '#7c3aed' : kit.main, ink: kit.main }
    default:
      return { main: kit.main, trim: kit.trim, ink: kit.ink }
  }
}

function torsoPath(g: Geo, inset: number) {
  const L = CX - g.shoulder + inset
  const R = CX + g.shoulder - inset
  const n = g.neck + 4
  return `M ${CX - n},${Y.shoulder - 6}
    L ${L + 6},${Y.shoulder - 2} Q ${L},${Y.shoulder} ${L},${Y.shoulder + 9}
    C ${L},${Y.shoulder + 44} ${CX - g.waist - 2},${Y.waist - 26} ${CX - g.waist},${Y.waist + 2}
    L ${CX + g.waist},${Y.waist + 2}
    C ${CX + g.waist + 2},${Y.waist - 26} ${R},${Y.shoulder + 44} ${R},${Y.shoulder + 9}
    Q ${R},${Y.shoulder} ${R - 6},${Y.shoulder - 2}
    L ${CX + n},${Y.shoulder - 6} Q ${CX},${Y.shoulder + 2} ${CX - n},${Y.shoulder - 6} Z`
}

function along(a: readonly [number, number], b: readonly [number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const
}

function limb(points: readonly (readonly [number, number])[]) {
  return `M ${points.map((p) => p.join(',')).join(' L ')}`
}

/** Legs, socks and shoes. */
export function Legs({ c, g, skin }: { c: PlayerAvatarConfig; g: Geo; skin: Skin }) {
  const kit = KITS[c.sport] ?? KITS.basketball
  const longSocks = c.shoes === 'shoes_football'
  const highTop = c.shoes === 'shoes_basketball'
  const shoe = {
    shoes_basketball: { body: '#f7f6f2', accent: kit.main, sole: '#1d1f2b' },
    shoes_football: { body: '#1d1f2b', accent: kit.main === '#109c4e' ? '#c6f135' : kit.main, sole: '#1d1f2b' },
    shoes_tennis: { body: '#ffffff', accent: '#7c3aed', sole: '#d9d4c7' },
    shoes_running: { body: kit.main, accent: '#ffffff', sole: '#f4f1ea' },
    shoes_badminton: { body: '#f2f1ec', accent: kit.main, sole: '#b9884f' },
    shoes_sneakers: { body: '#f4f2ed', accent: '#2a2c33', sole: '#f4f2ed' },
  }[c.shoes] ?? { body: '#f4f2ed', accent: '#2a2c33', sole: '#f4f2ed' }

  return (
    <g>
      {([-1, 1] as const).map((side) => {
        const x = legX(g, side)
        const foot = x + side * 3
        return (
          <g key={side}>
            <path d={limb([[x, Y.waist], [x + side * 1, Y.knee], [foot, Y.ankle]])} stroke={skin.base} strokeWidth={g.leg} strokeLinecap="round" fill="none" />
            {/* knee highlight */}
            <ellipse cx={x + side} cy={Y.knee} rx={g.leg * 0.22} ry={3} fill={skin.highlight} opacity={0.35} />
            {longSocks ? (
              <path d={limb([[x + side * 1, Y.knee + 6], [foot, Y.ankle]])} stroke={kit.main} strokeWidth={g.leg + 1.5} strokeLinecap="butt" fill="none" />
            ) : (
              <path d={limb([[foot, Y.ankle - (highTop ? 18 : 9)], [foot, Y.ankle]])} stroke="#f7f6f2" strokeWidth={g.leg} strokeLinecap="butt" fill="none" />
            )}
            {longSocks && <path d={limb([[x + side * 1.4, Y.knee + 10], [x + side * 1.6, Y.knee + 15]])} stroke={kit.trim} strokeWidth={g.leg + 1.6} fill="none" />}
            <Shoe x={foot} side={side} highTop={highTop} colors={shoe} studs={c.shoes === 'shoes_football'} />
          </g>
        )
      })}
    </g>
  )
}

function Shoe({
  x,
  side,
  highTop,
  colors,
  studs,
}: {
  x: number
  side: -1 | 1
  highTop: boolean
  colors: { body: string; accent: string; sole: string }
  studs: boolean
}) {
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
        stroke={shade(colors.body, 0.18)}
        strokeWidth={0.8}
      />
      {/* swoosh-like accent, kept abstract */}
      <path d={`M ${heel + side * 2},${Y.ankle + 8} Q ${x + side * 6},${Y.ankle + 10} ${toe - side * 2},${Y.ankle + 6}`} stroke={colors.accent} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <rect x={Math.min(heel, toe + side * 2) - 1} y={Y.sole - 5} width={Math.abs(toe + side * 2 - heel) + 2} height={5} rx={2.5} fill={colors.sole} />
      {studs &&
        [0.15, 0.5, 0.85].map((t) => (
          <rect key={t} x={heel + (toe - heel) * t - 1.5} y={Y.sole - 0.5} width={3} height={3} rx={1} fill="#9aa0a8" />
        ))}
    </g>
  )
}

/** Shorts / pants. */
export function Bottoms({ c, g }: { c: PlayerAvatarConfig; g: Geo }) {
  const kit = KITS[c.sport] ?? KITS.basketball
  const spec = {
    bottom_basketball_shorts: { bot: 296, flare: 7, fill: kit.main, trim: kit.trim },
    bottom_football_shorts: { bot: 262, flare: 4, fill: kit.trim === '#f4f4ef' ? '#f4f4ef' : '#1d1f2b', trim: kit.main },
    bottom_tennis_shorts: { bot: 266, flare: 4, fill: '#f6f5f0', trim: '#7c3aed' },
    bottom_running_shorts: { bot: 250, flare: 3, fill: '#1d1f2b', trim: kit.main },
    bottom_sweatpants: { bot: Y.ankle - 4, flare: 2, fill: '#8d929b', trim: '#7a7f88' },
    bottom_athletic_pants: { bot: Y.ankle - 6, flare: 1, fill: '#22252c', trim: kit.main },
  }[c.bottom] ?? { bot: 266, flare: 4, fill: '#1d1f2b', trim: kit.main }
  const long = spec.bot > 300
  const outer = (side: -1 | 1, y: number) => legX(g, side) + side * (g.leg / 2 + spec.flare * (long ? 0.3 : 1) + (y < Y.crotch ? 2 : 0))
  const inner = (side: -1 | 1) => legX(g, side) - side * (g.leg / 2 + (long ? 1.5 : 3))
  const d = `M ${CX - g.waist - 1},${Y.waist - 4} L ${CX + g.waist + 1},${Y.waist - 4}
    L ${outer(1, Y.waist + 20)},${Y.waist + 22} L ${outer(1, spec.bot)},${spec.bot} L ${inner(1)},${spec.bot}
    L ${CX},${Math.min(Y.crotch, spec.bot - 8)} L ${inner(-1)},${spec.bot} L ${outer(-1, spec.bot)},${spec.bot}
    L ${outer(-1, Y.waist + 20)},${Y.waist + 22} Z`
  return (
    <g>
      <path d={d} fill={spec.fill} stroke={shade(spec.fill, 0.2)} strokeWidth={0.8} strokeLinejoin="round" />
      <rect x={CX - g.waist - 1} y={Y.waist - 5} width={2 * g.waist + 2} height={7} rx={2} fill={shade(spec.fill, 0.12)} />
      {/* side stripe */}
      {([-1, 1] as const).map((side) => (
        <path key={side} d={`M ${outer(side, Y.waist + 20)},${Y.waist + 24} L ${outer(side, spec.bot) - side * 1.2},${spec.bot - 1}`} stroke={spec.trim} strokeWidth={3} />
      ))}
      {c.bottom === 'bottom_sweatpants' &&
        ([-1, 1] as const).map((side) => (
          <rect key={side} x={legX(g, side) - g.leg / 2 - 1} y={Y.ankle - 9} width={g.leg + 2} height={6} rx={3} fill={spec.trim} />
        ))}
      {c.bottom === 'bottom_sweatpants' && (
        <path d={`M ${CX - 3},${Y.waist - 1} l -2,10 M ${CX + 3},${Y.waist - 1} l 2,10`} stroke="#f4f4ef" strokeWidth={1.4} strokeLinecap="round" />
      )}
    </g>
  )
}

/** Bare arms (skin) — sleeves are drawn on top by <Top>. */
export function Arms({ g, skin, raised }: { g: Geo; skin: Skin; raised: boolean }) {
  return (
    <g>
      {([-1, 1] as const).map((side) => {
        const j = armJoints(g, side, raised && side === -1)
        const handR = g.arm * 0.56
        return (
          <g key={side}>
            <path d={limb([j.shoulder, j.elbow, j.wrist])} stroke={skin.base} strokeWidth={g.arm} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d={limb([j.shoulder, j.elbow])} stroke={skin.highlight} strokeWidth={g.arm * 0.25} strokeLinecap="round" fill="none" opacity={0.3} transform={`translate(${side * -g.arm * 0.18},0)`} />
            <circle cx={j.wrist[0]} cy={j.wrist[1] + (raised && side === -1 ? -handR * 0.7 : handR * 0.7)} r={handR} fill={skin.base} stroke={skin.mid} strokeWidth={0.8} />
          </g>
        )
      })}
    </g>
  )
}

/** Top garment, collar, number and sleeves. */
export function Top({ c, g, raised }: { c: PlayerAvatarConfig; g: Geo; raised: boolean }) {
  const col = topColors(c)
  const kit = KITS[c.sport] ?? KITS.basketball
  const sleeveless = SLEEVELESS.has(c.top)
  const longSleeve = LONG_SLEEVE.has(c.top)
  const inset = c.top === 'top_running_shirt' ? 12 : sleeveless ? 8 : 0
  const outline = shade(col.main, 0.18)

  const sleeve = (side: -1 | 1) => {
    if (sleeveless) return null
    const j = armJoints(g, side, raised && side === -1)
    const to = longSleeve ? j.wrist : ([j.shoulder[0] + (j.elbow[0] - j.shoulder[0]) * 0.55, j.shoulder[1] + (j.elbow[1] - j.shoulder[1]) * 0.55] as const)
    const pts = longSleeve ? [j.shoulder, j.elbow, to] : [j.shoulder, to]
    return (
      <g key={side}>
        <path d={limb(pts)} stroke={outline} strokeWidth={g.arm + 6.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d={limb(pts)} stroke={col.main} strokeWidth={g.arm + 5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {!longSleeve && (
          <path d={limb([along(j.shoulder, to, 0.8), to])} stroke={col.trim} strokeWidth={g.arm + 5} strokeLinecap="butt" fill="none" />
        )}
        {c.top === 'top_hoodie' && <circle cx={to[0]} cy={to[1]} r={(g.arm + 4) / 2} fill={col.trim} />}
      </g>
    )
  }

  return (
    <g>
      {c.top === 'top_hoodie' && (
        <path d={`M ${CX - g.neck - 14},${Y.shoulder - 4} Q ${CX},${Y.shoulder - 26} ${CX + g.neck + 14},${Y.shoulder - 4} Q ${CX},${Y.shoulder + 4} ${CX - g.neck - 14},${Y.shoulder - 4} Z`} fill={shade(col.main, 0.15)} />
      )}
      <path d={torsoPath(g, inset)} fill={col.main} stroke={outline} strokeWidth={0.9} strokeLinejoin="round" />
      {/* side shading */}
      <path d={`M ${CX + g.shoulder - inset - 4},${Y.shoulder + 14} C ${CX + g.shoulder - inset - 6},${Y.shoulder + 50} ${CX + g.waist + 2},${Y.waist - 30} ${CX + g.waist - 4},${Y.waist}`} stroke={shade(col.main, 0.1)} strokeWidth={6} fill="none" opacity={0.6} />

      {/* collars */}
      {(c.top === 'top_basketball_jersey' || c.top === 'top_tank' || c.top === 'top_running_shirt') && (
        <path d={`M ${CX - g.neck - 4},${Y.shoulder - 5} Q ${CX},${Y.shoulder + 22} ${CX + g.neck + 4},${Y.shoulder - 5}`} stroke={col.trim} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      )}
      {c.top === 'top_basketball_jersey' &&
        ([-1, 1] as const).map((side) => (
          <path key={side} d={`M ${CX + side * (g.neck + 5)},${Y.shoulder - 5} L ${CX + side * (g.shoulder - inset - 3)},${Y.shoulder - 1} Q ${CX + side * (g.shoulder - inset)},${Y.shoulder + 30} ${CX + side * (g.shoulder - inset + 1)},${Y.shoulder + 44}`} stroke={col.trim} strokeWidth={3} fill="none" strokeLinecap="round" />
        ))}
      {c.top === 'top_football_jersey' && (
        <path d={`M ${CX - g.neck - 4},${Y.shoulder - 5} L ${CX},${Y.shoulder + 12} L ${CX + g.neck + 4},${Y.shoulder - 5}`} stroke={col.trim} strokeWidth={3.4} fill="none" strokeLinejoin="round" />
      )}
      {(c.top === 'top_tee' || c.top === 'top_badminton_shirt' || c.top === 'top_compression' || c.top === 'top_hoodie') && (
        <path d={`M ${CX - g.neck - 3},${Y.shoulder - 5} Q ${CX},${Y.shoulder + 6} ${CX + g.neck + 3},${Y.shoulder - 5}`} stroke={shade(col.main, 0.22)} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      )}
      {c.top === 'top_tennis_shirt' && (
        <g>
          <path d={`M ${CX - g.neck - 5},${Y.shoulder - 6} L ${CX - 2},${Y.shoulder + 6} L ${CX - g.neck - 9},${Y.shoulder + 4} Z M ${CX + g.neck + 5},${Y.shoulder - 6} L ${CX + 2},${Y.shoulder + 6} L ${CX + g.neck + 9},${Y.shoulder + 4} Z`} fill={col.main} stroke={shade(col.main, 0.25)} strokeWidth={0.9} strokeLinejoin="round" />
          <path d={`M ${CX},${Y.shoulder + 6} L ${CX},${Y.shoulder + 22}`} stroke={shade(col.main, 0.25)} strokeWidth={1} />
          <circle cx={CX} cy={Y.shoulder + 12} r={1.2} fill={shade(col.main, 0.3)} />
          <circle cx={CX} cy={Y.shoulder + 18} r={1.2} fill={shade(col.main, 0.3)} />
          <path d={`M ${CX - g.shoulder + 4},${Y.shoulder + 40} L ${CX + g.shoulder - 4},${Y.shoulder + 40}`} stroke={col.trim} strokeWidth={4} opacity={0.9} />
        </g>
      )}
      {c.top === 'top_badminton_shirt' &&
        ([-1, 1] as const).map((side) => (
          <path key={side} d={`M ${CX + side * (g.shoulder - 4)},${Y.shoulder + 12} C ${CX + side * (g.shoulder - 8)},${Y.shoulder + 50} ${CX + side * (g.waist + 1)},${Y.waist - 30} ${CX + side * (g.waist - 2)},${Y.waist}`} stroke={kit.trim} strokeWidth={5} fill="none" />
        ))}
      {c.top === 'top_compression' &&
        ([-1, 1] as const).map((side) => (
          <path key={side} d={`M ${CX + side * 6},${Y.shoulder + 10} C ${CX + side * 16},${Y.shoulder + 40} ${CX + side * 10},${Y.waist - 40} ${CX + side * 12},${Y.waist}`} stroke={col.trim} strokeWidth={1.4} fill="none" opacity={0.8} />
        ))}
      {c.top === 'top_hoodie' && (
        <g>
          <path d={`M ${CX - 4},${Y.shoulder + 2} l -2,22 M ${CX + 4},${Y.shoulder + 2} l 2,22`} stroke="#e8e6e0" strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M ${CX - 20},${Y.waist - 34} L ${CX + 20},${Y.waist - 34} L ${CX + 24},${Y.waist - 10} L ${CX - 24},${Y.waist - 10} Z`} fill={shade(col.main, 0.1)} />
          <rect x={CX - g.waist} y={Y.waist - 6} width={2 * g.waist} height={8} rx={3} fill={col.trim} />
        </g>
      )}
      {/* chest number / logo */}
      {(c.top === 'top_basketball_jersey' || c.top === 'top_football_jersey' || c.top === 'top_tank') && kit.number && (
        <text x={CX} y={Y.shoulder + 58} textAnchor="middle" fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif" fontWeight={800} fontSize={30} fill={col.ink} stroke={c.top === 'top_tank' ? 'none' : col.trim} strokeWidth={1}>
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

export function Neck({ g, skin }: { g: Geo; skin: Skin }) {
  return (
    <g>
      <rect x={CX - g.neck} y={Y.neckTop} width={2 * g.neck} height={Y.shoulder - Y.neckTop + 2} rx={g.neck * 0.6} fill={skin.base} />
      <path d={`M ${CX - g.neck},${Y.neckTop + 6} Q ${CX},${Y.neckTop + 16} ${CX + g.neck},${Y.neckTop + 6} L ${CX + g.neck},${Y.neckTop} L ${CX - g.neck},${Y.neckTop} Z`} fill={skin.shadow} opacity={0.55} />
    </g>
  )
}
