import type { ReactNode } from 'react'
import type { PlayerAvatarConfig } from '../../schema'
import { CX, faceSpec, type FaceSpec, hairColor, type Skin } from './geometry'
import { INK, KITS, LIP, shade } from './palette'

/** Head space: crown at y = 36, cheekbones ~66, chin ~100. */
const TOP = 36
const EYE_Y = 68
const EYE_DX = 11

function facePath(f: FaceSpec) {
  const { cheek: w, jaw, chinW, chin, cheekY: m } = f
  return `M ${CX},${TOP}
    C ${CX + w * 0.78},${TOP} ${CX + w},${TOP + w * 0.55} ${CX + w},${m}
    C ${CX + w},${m + 16} ${CX + jaw + 3},${chin - 10} ${CX + chinW},${chin}
    Q ${CX},${chin + 2.5} ${CX - chinW},${chin}
    C ${CX - jaw - 3},${chin - 10} ${CX - w},${m + 16} ${CX - w},${m}
    C ${CX - w},${TOP + w * 0.55} ${CX - w * 0.78},${TOP} ${CX},${TOP} Z`
}

export function Face({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const f = faceSpec(c.face)
  return (
    <g>
      {([-1, 1] as const).map((s) => (
        <g key={s}>
          <ellipse cx={CX + s * (f.cheek + 1)} cy={71} rx={5.5} ry={8} fill={skin.base} stroke={skin.mid} strokeWidth={0.8} />
          <path d={`M ${CX + s * (f.cheek + 2.5)},${67} q ${s * 2},4 0,8`} stroke={skin.shadow} strokeWidth={1.2} fill="none" strokeLinecap="round" />
        </g>
      ))}
      <path d={facePath(f)} fill={skin.base} stroke={skin.mid} strokeWidth={0.9} />
      {/* soft jaw shading + forehead light */}
      <path d={`M ${CX - f.jaw - 2},${f.chin - 14} Q ${CX},${f.chin + 4} ${CX + f.jaw + 2},${f.chin - 14} Q ${CX},${f.chin - 2} ${CX - f.jaw - 2},${f.chin - 14} Z`} fill={skin.mid} opacity={0.45} />
      <ellipse cx={CX - 6} cy={TOP + 12} rx={12} ry={5} fill={skin.highlight} opacity={0.35} />
      {([-1, 1] as const).map((s) => (
        <ellipse key={s} cx={CX + s * 16} cy={81} rx={5} ry={3} fill="#e0705a" opacity={0.12} />
      ))}
    </g>
  )
}

export function Eyes({ c }: { c: PlayerAvatarConfig }) {
  const v = { eyes_01: [5, 3.7], eyes_02: [5, 3.1], eyes_03: [5.6, 4.4], eyes_04: [5.4, 2.5], eyes_05: [5, 4.9] }[c.eyes] ?? [5, 3.7]
  const [rx, ry] = v
  const iris = Math.min(ry, 3) + (c.eyes === 'eyes_03' ? 0.4 : 0)
  return (
    <g>
      {([-1, 1] as const).map((s) => {
        const x = CX + s * EYE_DX
        return (
          <g key={s}>
            <ellipse cx={x} cy={EYE_Y} rx={rx} ry={ry} fill="#fbfaf7" />
            <circle cx={x + s * 0.3} cy={EYE_Y + 0.3} r={iris} fill="#4a2e1d" />
            <circle cx={x + s * 0.3} cy={EYE_Y + 0.3} r={iris * 0.5} fill={INK} />
            <circle cx={x + s * 0.3 - 1} cy={EYE_Y - 0.9} r={c.eyes === 'eyes_03' ? 1.2 : 0.85} fill="#fff" />
            {/* upper lid / lash line */}
            <path
              d={`M ${x - rx - 0.6},${EYE_Y + 0.4} Q ${x},${EYE_Y - ry * (c.eyes === 'eyes_02' ? 1.05 : 1.45)} ${x + rx + 0.6},${EYE_Y + 0.4}`}
              stroke={INK}
              strokeWidth={c.eyes === 'eyes_04' ? 1.5 : 1.7}
              fill="none"
              strokeLinecap="round"
            />
            {c.eyes === 'eyes_02' && <path d={`M ${x - rx},${EYE_Y - 1.4} L ${x + rx},${EYE_Y - 1.4}`} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />}
          </g>
        )
      })}
    </g>
  )
}

export function Brows({ c }: { c: PlayerAvatarConfig }) {
  const color = shade(hairColor(c), c.hairColor === 'platinum' || c.hairColor === 'blonde' ? 0.35 : 0.1)
  const spec: Record<string, { w: number; d: (s: number) => string }> = {
    brow_straight: { w: 2.4, d: (s) => `M ${CX + s * 6},60 L ${CX + s * 17},59.5` },
    brow_curved: { w: 2.3, d: (s) => `M ${CX + s * 6},60.5 Q ${CX + s * 11},56.5 ${CX + s * 17},59.5` },
    brow_thick: { w: 3.8, d: (s) => `M ${CX + s * 6},60 Q ${CX + s * 11},57.5 ${CX + s * 17},59.5` },
    brow_thin: { w: 1.3, d: (s) => `M ${CX + s * 6.5},59.5 Q ${CX + s * 11},57 ${CX + s * 16.5},59` },
    brow_athletic: { w: 3, d: (s) => `M ${CX + s * 6},61.5 L ${CX + s * 13},57.8 L ${CX + s * 17.5},59.4` },
    brow_expressive: { w: 2.4, d: (s) => `M ${CX + s * 6},59.5 Q ${CX + s * 10},53.5 ${CX + s * 17},57.5` },
  }
  const b = spec[c.eyebrows] ?? spec.brow_curved
  return (
    <g>
      {([-1, 1] as const).map((s) => (
        <path key={s} d={b.d(s)} stroke={color} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </g>
  )
}

export function Nose({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const col = shade(skin.shadow, 0.05)
  const w = { nose_small: 3.5, nose_medium: 4.5, nose_large: 5.5, nose_straight: 4, nose_rounded: 5, nose_wide: 6.8, nose_narrow: 3 }[c.nose] ?? 4.5
  const tipY = { nose_small: 79, nose_large: 82, nose_straight: 81 }[c.nose] ?? 80.5
  return (
    <g stroke={col} strokeWidth={1.4} fill="none" strokeLinecap="round">
      {c.nose === 'nose_straight' && <path d={`M ${CX + 1.5},68 L ${CX + 2.5},${tipY - 2}`} opacity={0.7} />}
      {c.nose === 'nose_rounded' && <circle cx={CX} cy={tipY - 2} r={3} fill={skin.highlight} stroke="none" opacity={0.45} />}
      <path d={`M ${CX - w},${tipY - 1} Q ${CX - w - 1.2},${tipY + 2} ${CX - w * 0.35},${tipY + 1.6} Q ${CX},${tipY + 3} ${CX + w * 0.35},${tipY + 1.6} Q ${CX + w + 1.2},${tipY + 2} ${CX + w},${tipY - 1}`} />
    </g>
  )
}

export function Mouth({ c }: { c: PlayerAvatarConfig }) {
  const y = 89
  switch (c.mouth) {
    case 'mouth_big_smile':
      return (
        <g>
          <path d={`M ${CX - 8},${y - 1} Q ${CX},${y + 9} ${CX + 8},${y - 1} Z`} fill="#5a2320" />
          <path d={`M ${CX - 6.6},${y - 0.4} Q ${CX},${y + 2.4} ${CX + 6.6},${y - 0.4} L ${CX + 6},${y + 1.4} Q ${CX},${y + 3.6} ${CX - 6},${y + 1.4} Z`} fill="#fbfaf7" />
          <path d={`M ${CX - 4},${y + 5.4} Q ${CX},${y + 7.2} ${CX + 4},${y + 5.4}`} stroke="#d46a6a" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'mouth_smile':
      return <path d={`M ${CX - 7},${y - 1} Q ${CX},${y + 5.5} ${CX + 7},${y - 1}`} stroke={LIP} strokeWidth={2} fill="none" strokeLinecap="round" />
    case 'mouth_serious':
      return <path d={`M ${CX - 5},${y + 0.5} L ${CX + 5},${y + 0.5}`} stroke={LIP} strokeWidth={2} strokeLinecap="round" />
    case 'mouth_confident':
      return <path d={`M ${CX - 6},${y + 1} Q ${CX + 1},${y + 3} ${CX + 7},${y - 2.5}`} stroke={LIP} strokeWidth={2} fill="none" strokeLinecap="round" />
    case 'mouth_relaxed':
      return <path d={`M ${CX - 6},${y} Q ${CX},${y + 2.8} ${CX + 6},${y}`} stroke={LIP} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    default:
      return <path d={`M ${CX - 6},${y + 0.5} Q ${CX},${y + 1.8} ${CX + 6},${y + 0.5}`} stroke={LIP} strokeWidth={1.9} fill="none" strokeLinecap="round" />
  }
}

export function FacialHair({ c }: { c: PlayerAvatarConfig }) {
  if (c.facialHair === 'beard_none') return null
  const f = faceSpec(c.face)
  const col = hairColor(c)
  const jaw = (inset: number, top: number) =>
    `M ${CX - f.cheek + inset},${top}
     C ${CX - f.cheek + inset},${f.cheekY + 16} ${CX - f.jaw - 3 + inset},${f.chin - 10} ${CX - f.chinW},${f.chin}
     Q ${CX},${f.chin + 2.5} ${CX + f.chinW},${f.chin}
     C ${CX + f.jaw + 3 - inset},${f.chin - 10} ${CX + f.cheek - inset},${f.cheekY + 16} ${CX + f.cheek - inset},${top}`
  const moustache = <path d={`M ${CX - 9},${88} Q ${CX - 5},${82.5} ${CX},${85} Q ${CX + 5},${82.5} ${CX + 9},${88} Q ${CX},${85.5} ${CX - 9},${88} Z`} fill={col} />
  const beard = (heavy: boolean) => (
    <path
      d={`${jaw(0.4, 70)} L ${CX + f.cheek - (heavy ? 7 : 4)},70 C ${CX + 16},${heavy ? 84 : 92} ${CX + 12},${f.chin - (heavy ? 12 : 7)} ${CX},${f.chin - (heavy ? 9 : 5)} C ${CX - 12},${f.chin - (heavy ? 12 : 7)} ${CX - 16},${heavy ? 84 : 92} ${CX - f.cheek + (heavy ? 7 : 4)},70 Z`}
      fill={col}
    />
  )
  switch (c.facialHair) {
    case 'beard_stubble':
      return <path d={`${jaw(0.5, 74)} L ${CX + 14},84 Q ${CX},${f.chin - 8} ${CX - 14},84 Z`} fill={col} opacity={0.22} />
    case 'beard_mustache':
      return moustache
    case 'beard_goatee':
      return (
        <g>
          {moustache}
          <path d={`M ${CX - 7},${f.chin - 7} Q ${CX},${f.chin - 10} ${CX + 7},${f.chin - 7} Q ${CX + 6},${f.chin + 2} ${CX},${f.chin + 2.5} Q ${CX - 6},${f.chin + 2} ${CX - 7},${f.chin - 7} Z`} fill={col} />
        </g>
      )
    case 'beard_short':
      return beard(false)
    case 'beard_full':
      return beard(true)
    case 'beard_full_mustache':
      return (
        <g>
          {beard(true)}
          {moustache}
        </g>
      )
    default:
      return null
  }
}

/** Generic hair cap over the skull: `vol` adds height, `side` is how far down the temples it reaches. */
function cap(f: FaceSpec, vol: number, side = 64, hairline = 50, spread = 1) {
  const L = CX - f.cheek * spread - 1.5
  const R = CX + f.cheek * spread + 1.5
  return `M ${L},${side}
    C ${L - 3},${TOP - 22 - vol} ${R + 3},${TOP - 22 - vol} ${R},${side}
    L ${R - 4},${side}
    C ${R - 5},${hairline} ${CX + f.cheek * 0.45},${hairline - 7} ${CX},${hairline - 5}
    C ${CX - f.cheek * 0.45},${hairline - 7} ${L + 5},${hairline} ${L + 4},${side} Z`
}

/** Hair drawn behind the head (volume, long strands). */
export function HairBack({ c }: { c: PlayerAvatarConfig }) {
  const col = hairColor(c)
  const dark = shade(col, 0.25)
  const f = faceSpec(c.face)
  switch (c.hair) {
    case 'hair_afro':
      return <circle cx={CX} cy={52} r={f.cheek + 15} fill={col} />
    case 'hair_wavy_med':
      return <path d={`M ${CX - f.cheek - 8},96 C ${CX - f.cheek - 16},40 ${CX - 10},18 ${CX},22 C ${CX + 10},18 ${CX + f.cheek + 16},40 ${CX + f.cheek + 8},96 Q ${CX},104 ${CX - f.cheek - 8},96 Z`} fill={col} />
    case 'hair_locs':
    case 'hair_box_braids': {
      // Strands fall from the crown, around the head and over the back of the shoulders.
      const locs = c.hair === 'hair_locs'
      const n = locs ? 8 : 12
      const w = locs ? 6 : 3.6
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const t = i / (n - 1) - 0.5
            const x0 = CX + t * 2 * (f.cheek - 2)
            const x1 = CX + t * 2 * (f.cheek + 12)
            const end = 128 - Math.abs(t) * 18
            return <path key={i} d={`M ${x0},44 C ${x0 + t * 30},70 ${x1},${end - 30} ${x1 + t * 4},${end}`} stroke={i % 2 ? col : dark} strokeWidth={w} strokeLinecap="round" fill="none" />
          })}
        </g>
      )
    }
    case 'hair_ponytail':
      return <path d={`M ${CX + 14},40 C ${CX + 44},36 ${CX + 46},80 ${CX + 36},118 C ${CX + 32},96 ${CX + 30},70 ${CX + 14},56 Z`} fill={col} />
    default:
      return null
  }
}

/** Hair on top of the head. */
export function HairFront({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const col = hairColor(c)
  const dark = shade(col, 0.28)
  const f = faceSpec(c.face)
  const fill = (d: string, extra?: ReactNode) => (
    <g>
      <path d={d} fill={col} />
      {extra}
    </g>
  )
  switch (c.hair) {
    case 'hair_buzz':
      return <path d={cap(f, -7, 62, 49)} fill={col} opacity={0.8} />
    case 'hair_fade_low':
    case 'hair_fade_mid':
    case 'hair_fade_high': {
      const sideOpacity = { hair_fade_low: 0.75, hair_fade_mid: 0.45, hair_fade_high: 0.18 }[c.hair]
      return (
        <g>
          <path d={cap(f, -4, 66, 50)} fill={col} opacity={sideOpacity} />
          <path d={cap(f, 2, 52, 49, 0.82)} fill={col} />
        </g>
      )
    }
    case 'hair_crop':
      return fill(
        cap(f, 3, 60, 50),
        <path d={`M ${CX - 20},47 l 5,-6 l 4,5 l 5,-6 l 4,5 l 5,-6 l 4,5 l 5,-5 l 4,6`} stroke={dark} strokeWidth={1.6} fill="none" strokeLinejoin="round" />,
      )
    case 'hair_curls_short':
    case 'hair_twists':
      return (
        <g>
          <path d={cap(f, 4, 62, 49)} fill={col} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.08 + (0.84 * i) / 8)
            const x = CX - Math.cos(a) * (f.cheek + 1)
            const y = 42 - Math.sin(a) * 15
            return c.hair === 'hair_curls_short' ? (
              <circle key={i} cx={x} cy={y} r={6.5} fill={col} stroke={dark} strokeWidth={0.9} />
            ) : (
              <rect key={i} x={x - 3} y={y - 9} width={6} height={15} rx={3} fill={col} stroke={dark} strokeWidth={0.9} />
            )
          })}
        </g>
      )
    case 'hair_wavy_med':
      return fill(`${cap(f, 8, 74, 52)}`, <path d={`M ${CX - 4},38 Q ${CX - 18},44 ${CX - f.cheek + 2},62`} stroke={dark} strokeWidth={1.5} fill="none" />)
    case 'hair_afro':
      return <path d={cap(f, 8, 60, 50, 1.02)} fill={col} />
    case 'hair_locs':
      return fill(cap(f, 6, 62, 49), <path d={`M ${CX - 14},42 l 2,12 M ${CX - 4},39 l 1,13 M ${CX + 6},39 l -1,13 M ${CX + 15},42 l -2,12`} stroke={dark} strokeWidth={1.6} strokeLinecap="round" />)
    case 'hair_braids':
      return (
        <g>
          <path d={cap(f, -1, 64, 48)} fill={col} />
          <path d={`M ${CX},28 L ${CX},48`} stroke={skin.mid} strokeWidth={1.4} />
          {([-1, 1] as const).map((s) =>
            Array.from({ length: 7 }, (_, i) => (
              <ellipse key={`${s}${i}`} cx={CX + s * (f.cheek + 4) + s * i * 0.6} cy={74 + i * 10} rx={5} ry={6.2} fill={i % 2 ? col : dark} />
            )),
          )}
        </g>
      )
    case 'hair_ponytail':
      return fill(cap(f, -2, 62, 48), <path d={`M ${CX - 10},40 Q ${CX + 6},34 ${CX + 22},42`} stroke={dark} strokeWidth={1.4} fill="none" />)
    case 'hair_box_braids':
      return fill(cap(f, 2, 64, 48), <path d={`M ${CX},27 L ${CX},48 M ${CX - 12},30 L ${CX - 14},48 M ${CX + 12},30 L ${CX + 14},48`} stroke={dark} strokeWidth={1.2} />)
    case 'hair_cornrows':
      return (
        <g>
          <path d={cap(f, -3, 62, 48)} fill={col} />
          {[-15, -7.5, 0, 7.5, 15].map((dx) => (
            <path key={dx} d={`M ${CX + dx * 1.15},47 Q ${CX + dx * 1.05},34 ${CX + dx * 0.7},24`} stroke={skin.mid} strokeWidth={1.3} fill="none" opacity={0.85} />
          ))}
        </g>
      )
    default:
      return <path d={cap(f, 0, 62, 50)} fill={col} />
  }
}

export function Headwear({ c }: { c: PlayerAvatarConfig }) {
  if (!c.headwear) return null
  const kit = KITS[c.sport] ?? KITS.basketball
  const f = faceSpec(c.face)
  const band = kit.main === '#f6f5f0' ? kit.trim : kit.main
  switch (c.headwear) {
    case 'head_cap':
      return (
        <g>
          <path d={`M ${CX - f.cheek - 3},56 C ${CX - f.cheek - 4},16 ${CX + f.cheek + 4},16 ${CX + f.cheek + 3},56 Z`} fill={band} stroke={shade(band, 0.2)} strokeWidth={0.9} />
          <path d={`M ${CX - f.cheek - 2},54 Q ${CX},44 ${CX + f.cheek + 18},56 Q ${CX + 8},62 ${CX - f.cheek - 2},58 Z`} fill={shade(band, 0.18)} />
          <circle cx={CX} cy={24} r={2} fill={shade(band, 0.25)} />
          <path d={`M ${CX - 10},40 L ${CX + 10},40`} stroke={kit.ink === band ? '#fff' : kit.ink} strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
        </g>
      )
    case 'head_headband':
      return <path d={`M ${CX - f.cheek - 1.5},52 Q ${CX},42 ${CX + f.cheek + 1.5},52 L ${CX + f.cheek + 1.5},59 Q ${CX},49 ${CX - f.cheek - 1.5},59 Z`} fill={band} />
    case 'head_bandana':
      return (
        <g>
          <path d={`M ${CX - f.cheek - 2},54 C ${CX - f.cheek - 2},20 ${CX + f.cheek + 2},20 ${CX + f.cheek + 2},54 Q ${CX},44 ${CX - f.cheek - 2},54 Z`} fill={band} />
          <path d={`M ${CX + f.cheek},50 l 10,4 l -6,6 Z M ${CX + f.cheek},50 l 12,-4 l -2,8 Z`} fill={shade(band, 0.15)} />
          {[[-8, 34], [6, 30], [14, 42], [-16, 44]].map(([dx, y]) => (
            <circle key={`${dx}${y}`} cx={CX + dx} cy={y} r={1.6} fill="#ffffff" opacity={0.7} />
          ))}
        </g>
      )
    default:
      return null
  }
}

export function Eyewear({ c }: { c: PlayerAvatarConfig }) {
  if (!c.eyewear) return null
  if (c.eyewear === 'eye_sport') {
    return (
      <g>
        <path d={`M ${CX - 22},64 Q ${CX},60 ${CX + 22},64 L ${CX + 20},72 Q ${CX + 12},76 ${CX + 3},72 L ${CX},70 L ${CX - 3},72 Q ${CX - 12},76 ${CX - 20},72 Z`} fill="url(#ftg-av-shade)" stroke={INK} strokeWidth={1} />
        <defs>
          <linearGradient id="ftg-av-shade" x1="0" x2="1">
            <stop offset="0" stopColor="#ff5a1f" />
            <stop offset="0.5" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      </g>
    )
  }
  const sun = c.eyewear === 'eye_sunglasses'
  return (
    <g fill={sun ? '#1b1d22' : 'none'} stroke={INK} strokeWidth={1.6}>
      {([-1, 1] as const).map((s) => (
        <rect key={s} x={CX + s * EYE_DX - 7.5} y={EYE_Y - 5.5} width={15} height={11} rx={4.5} fillOpacity={sun ? 0.92 : 0} />
      ))}
      <path d={`M ${CX - 3.5},${EYE_Y - 1} Q ${CX},${EYE_Y - 3} ${CX + 3.5},${EYE_Y - 1}`} fill="none" />
    </g>
  )
}
