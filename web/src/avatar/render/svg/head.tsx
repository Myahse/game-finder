import type { ReactNode } from 'react'
import type { PlayerAvatarConfig } from '../../schema'
import { EYE_COLORS, LIP_COLORS } from '../../registry'
import { CX, faceSpec, type FaceSpec, hairColor, kitOf, type Skin } from './geometry'
import { INK, mix, shade } from './palette'

/** Head space: crown at y = 36, cheekbones ~66, chin ~100. Light comes from the upper left. */
const TOP = 36
const EYE_Y = 68
const EYE_DX = 11

const outlineOf = (hex: string) => shade(hex, 0.38)

function facePath(f: FaceSpec) {
  const { cheek: w, jaw, chinW, chin, cheekY: m } = f
  return `M ${CX},${TOP}
    C ${CX + w * 0.78},${TOP} ${CX + w},${TOP + w * 0.55} ${CX + w},${m}
    C ${CX + w},${m + 16} ${CX + jaw + 3},${chin - 10} ${CX + chinW},${chin}
    Q ${CX},${chin + 2.5} ${CX - chinW},${chin}
    C ${CX - jaw - 3},${chin - 10} ${CX - w},${m + 16} ${CX - w},${m}
    C ${CX - w},${TOP + w * 0.55} ${CX - w * 0.78},${TOP} ${CX},${TOP} Z`
}

export function Face({ c, skin, uid }: { c: PlayerAvatarConfig; skin: Skin; uid: string }) {
  const f = faceSpec(c.face)
  const clip = `${uid}-face`
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={facePath(f)} />
        </clipPath>
      </defs>
      {([-1, 1] as const).map((s) => (
        <g key={s}>
          <ellipse cx={CX + s * (f.cheek + 1)} cy={71} rx={5.5} ry={8} fill={s > 0 ? mix(skin.base, skin.shadow, 0.25) : skin.base} stroke={outlineOf(skin.base)} strokeWidth={1} />
          <path d={`M ${CX + s * (f.cheek + 2.5)},${67} q ${s * 2},4 0,8`} stroke={skin.shadow} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        </g>
      ))}
      <path d={facePath(f)} fill={skin.base} />
      <g clipPath={`url(#${clip})`}>
        {/* form shadow on the far cheek + under the jaw */}
        <ellipse cx={CX + f.cheek + 7} cy={74} rx={13} ry={44} fill={skin.shadow} opacity={0.32} />
        <path d={`M ${CX - f.jaw - 6},${f.chin - 12} Q ${CX},${f.chin + 8} ${CX + f.jaw + 6},${f.chin - 12} L ${CX + f.jaw + 6},${f.chin + 6} L ${CX - f.jaw - 6},${f.chin + 6} Z`} fill={skin.mid} opacity={0.4} />
        <ellipse cx={CX - 7} cy={TOP + 13} rx={13} ry={6} fill={skin.highlight} opacity={0.45} />
        <ellipse cx={CX - 15} cy={75} rx={6} ry={3.2} fill={skin.highlight} opacity={0.35} />
      </g>
      <path d={facePath(f)} fill="none" stroke={outlineOf(skin.base)} strokeWidth={1.1} />
      {([-1, 1] as const).map((s) => (
        <ellipse key={s} cx={CX + s * 16} cy={81} rx={5} ry={3} fill="#e0705a" opacity={0.13} />
      ))}
    </g>
  )
}

export function Eyes({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const [rx, ry] = { eyes_01: [5, 3.7], eyes_02: [5, 3.1], eyes_03: [5.6, 4.4], eyes_04: [5.4, 2.5], eyes_05: [5, 4.9] }[c.eyes] ?? [5, 3.7]
  const iris = Math.min(ry, 3) + (c.eyes === 'eyes_03' ? 0.45 : 0.1)
  const eyeHex = EYE_COLORS.find((e) => e.id === c.eyeColor)?.hex ?? EYE_COLORS[0].hex
  const lashes = c.lashes ?? 'none'
  const lid = lashes === 'bold' ? 2.4 : c.eyes === 'eyes_04' ? 1.5 : 1.75
  return (
    <g>
      {([-1, 1] as const).map((s) => {
        const x = CX + s * EYE_DX
        return (
          <g key={s}>
            {/* crease */}
            <path d={`M ${x - rx + 0.5},${EYE_Y - ry - 1.4} Q ${x},${EYE_Y - ry - 3.6} ${x + rx - 0.5},${EYE_Y - ry - 1.4}`} stroke={skin.shadow} strokeWidth={0.9} fill="none" opacity={0.65} />
            <ellipse cx={x} cy={EYE_Y} rx={rx} ry={ry} fill="#fbfaf7" />
            <ellipse cx={x} cy={EYE_Y - ry * 0.55} rx={rx * 0.9} ry={ry * 0.45} fill="#d9d3cb" opacity={0.5} />
            <circle cx={x + s * 0.3} cy={EYE_Y + 0.3} r={iris} fill={eyeHex} stroke={shade(eyeHex, 0.5)} strokeWidth={0.7} />
            <circle cx={x + s * 0.3} cy={EYE_Y + 0.3} r={iris * 0.48} fill={INK} />
            <circle cx={x + s * 0.3 - 1.1} cy={EYE_Y - 1} r={c.eyes === 'eyes_03' ? 1.25 : 0.95} fill="#fff" />
            <circle cx={x + s * 0.3 + 1} cy={EYE_Y + 1.3} r={0.45} fill="#fff" opacity={0.85} />
            {/* upper lid / lash line */}
            <path
              d={`M ${x - rx - 0.6},${EYE_Y + 0.4} Q ${x},${EYE_Y - ry * (c.eyes === 'eyes_02' ? 1.05 : 1.45)} ${x + rx + 0.6},${EYE_Y + 0.4}`}
              stroke={INK}
              strokeWidth={lid}
              fill="none"
              strokeLinecap="round"
            />
            {c.eyes === 'eyes_02' && <path d={`M ${x - rx},${EYE_Y - 1.4} L ${x + rx},${EYE_Y - 1.4}`} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />}
            {/* lower lid */}
            <path d={`M ${x - rx + 1},${EYE_Y + ry * 0.75} Q ${x},${EYE_Y + ry + 1} ${x + rx - 1},${EYE_Y + ry * 0.75}`} stroke={skin.shadow} strokeWidth={0.7} fill="none" opacity={0.6} />
            {lashes !== 'none' && (
              <g stroke={INK} strokeWidth={lashes === 'bold' ? 1.3 : 1} strokeLinecap="round" fill="none">
                <path d={`M ${x + s * (rx + 0.2)},${EYE_Y - 0.2} l ${s * 2.4},${-2}`} />
                <path d={`M ${x + s * (rx - 1.6)},${EYE_Y - ry + 0.6} l ${s * 1.8},${-2.4}`} />
                {lashes === 'bold' && <path d={`M ${x + s * (rx - 3.8)},${EYE_Y - ry - 0.4} l ${s * 1},${-2.4}`} />}
                {lashes === 'bold' && <path d={`M ${x + s * (rx - 0.6)},${EYE_Y + ry * 0.55} l ${s * 1.6},${0.9}`} strokeWidth={0.8} />}
              </g>
            )}
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
        <g key={s}>
          <path d={b.d(s)} stroke={color} strokeWidth={b.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* tapered tail */}
          <path d={b.d(s)} stroke={shade(color, -0.25)} strokeWidth={b.w * 0.35} strokeLinecap="round" fill="none" opacity={0.35} transform="translate(0 -0.5)" />
        </g>
      ))}
    </g>
  )
}

export function Nose({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const col = shade(skin.shadow, 0.05)
  const w = { nose_small: 3.5, nose_medium: 4.5, nose_large: 5.5, nose_straight: 4, nose_rounded: 5, nose_wide: 6.8, nose_narrow: 3 }[c.nose] ?? 4.5
  const tipY = { nose_small: 79, nose_large: 82, nose_straight: 81 }[c.nose] ?? 80.5
  return (
    <g>
      {/* bridge light + shadow under the tip */}
      <path d={`M ${CX - 1.2},66 L ${CX - 1.6},${tipY - 3}`} stroke={skin.highlight} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
      <path d={`M ${CX + 1.8},68 Q ${CX + w * 0.6},${tipY - 3} ${CX + w * 0.4},${tipY - 0.5}`} stroke={skin.shadow} strokeWidth={1.4} fill="none" opacity={0.35} />
      <ellipse cx={CX} cy={tipY + 3} rx={w * 0.7} ry={1.2} fill={skin.shadow} opacity={0.25} />
      <g stroke={col} strokeWidth={1.4} fill="none" strokeLinecap="round">
        {c.nose === 'nose_straight' && <path d={`M ${CX + 1.5},68 L ${CX + 2.5},${tipY - 2}`} opacity={0.7} />}
        {c.nose === 'nose_rounded' && <circle cx={CX} cy={tipY - 2} r={3} fill={skin.highlight} stroke="none" opacity={0.45} />}
        <path d={`M ${CX - w},${tipY - 1} Q ${CX - w - 1.2},${tipY + 2} ${CX - w * 0.35},${tipY + 1.6} Q ${CX},${tipY + 3} ${CX + w * 0.35},${tipY + 1.6} Q ${CX + w + 1.2},${tipY + 2} ${CX + w},${tipY - 1}`} />
      </g>
    </g>
  )
}

export function Mouth({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const y = 89
  const chosen = LIP_COLORS.find((l) => l.id === c.lipColor)
  const painted = !!chosen && chosen.id !== 'natural'
  const lip = painted ? chosen.hex : mix(LIP_COLORS[0].hex, skin.shadow, 0.45)
  const lipOpacity = painted ? 0.95 : 0.55
  const line = shade(lip, 0.45)
  const upper = (dy = 0) => <path d={`M ${CX - 6},${y + dy} Q ${CX - 3},${y - 2.8 + dy} ${CX},${y - 1.4 + dy} Q ${CX + 3},${y - 2.8 + dy} ${CX + 6},${y + dy} Q ${CX},${y + 0.8 + dy} ${CX - 6},${y + dy} Z`} fill={lip} opacity={lipOpacity} />
  const lower = (d: string) => (
    <g>
      <path d={d} fill={lip} opacity={lipOpacity} />
      <path d={`M ${CX - 2},${y + 3} q 2,0.8 4,0`} stroke="#fff" strokeWidth={0.9} opacity={painted ? 0.45 : 0.25} strokeLinecap="round" />
    </g>
  )
  switch (c.mouth) {
    case 'mouth_big_smile':
      return (
        <g>
          <path d={`M ${CX - 8.6},${y - 1.6} Q ${CX},${y + 10.4} ${CX + 8.6},${y - 1.6} Q ${CX},${y - 0.2} ${CX - 8.6},${y - 1.6} Z`} fill={lip} opacity={painted ? 1 : 0.7} />
          <path d={`M ${CX - 8},${y - 1} Q ${CX},${y + 9} ${CX + 8},${y - 1} Z`} fill="#5a2320" />
          <path d={`M ${CX - 6.6},${y - 0.4} Q ${CX},${y + 2.4} ${CX + 6.6},${y - 0.4} L ${CX + 6},${y + 1.4} Q ${CX},${y + 3.6} ${CX - 6},${y + 1.4} Z`} fill="#fbfaf7" />
          <path d={`M ${CX - 4},${y + 5.4} Q ${CX},${y + 7.2} ${CX + 4},${y + 5.4}`} stroke="#d46a6a" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'mouth_smile':
      return (
        <g>
          {lower(`M ${CX - 6},${y + 1.4} Q ${CX},${y + 8.6} ${CX + 6},${y + 1.4} Q ${CX},${y + 5.4} ${CX - 6},${y + 1.4} Z`)}
          {painted && upper(0.4)}
          <path d={`M ${CX - 7},${y - 1} Q ${CX},${y + 5.5} ${CX + 7},${y - 1}`} stroke={line} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'mouth_serious':
      return (
        <g>
          {lower(`M ${CX - 4.6},${y + 1} Q ${CX},${y + 4.2} ${CX + 4.6},${y + 1} Z`)}
          {upper(0.3)}
          <path d={`M ${CX - 5},${y + 0.5} L ${CX + 5},${y + 0.5}`} stroke={line} strokeWidth={1.7} strokeLinecap="round" />
        </g>
      )
    case 'mouth_confident':
      return (
        <g>
          {lower(`M ${CX - 5},${y + 1.6} Q ${CX + 1},${y + 5.4} ${CX + 5},${y + 0.6} Z`)}
          <path d={`M ${CX - 6},${y + 1} Q ${CX + 1},${y + 3} ${CX + 7},${y - 2.5}`} stroke={line} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'mouth_relaxed':
      return (
        <g>
          {lower(`M ${CX - 5.4},${y + 1} Q ${CX},${y + 5.8} ${CX + 5.4},${y + 1} Z`)}
          {upper(0)}
          <path d={`M ${CX - 6},${y} Q ${CX},${y + 2.8} ${CX + 6},${y}`} stroke={line} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      )
    default:
      return (
        <g>
          {lower(`M ${CX - 5.4},${y + 1.2} Q ${CX},${y + 5.6} ${CX + 5.4},${y + 1.2} Z`)}
          {upper(0.2)}
          <path d={`M ${CX - 6},${y + 0.5} Q ${CX},${y + 1.8} ${CX + 6},${y + 0.5}`} stroke={line} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        </g>
      )
  }
}

/** Freckles, beauty mark, dimples, eye black. */
export function FaceDetails({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const d = new Set(c.details ?? [])
  if (!d.size) return null
  return (
    <g>
      {d.has('freckles') &&
        [
          [-15, 76],
          [-12, 79],
          [-17.5, 80],
          [-9, 77],
          [-13, 82.5],
          [15, 76],
          [12, 79],
          [17.5, 80],
          [9, 77],
          [13, 82.5],
          [-3, 73.5],
          [3, 73.5],
        ].map(([dx, y]) => <circle key={`${dx}${y}`} cx={CX + dx} cy={y} r={0.75} fill={shade(skin.shadow, 0.15)} opacity={0.7} />)}
      {d.has('beauty_mark') && <circle cx={CX + 10} cy={86} r={1.05} fill="#3b2418" />}
      {d.has('dimples') &&
        ([-1, 1] as const).map((s) => <path key={s} d={`M ${CX + s * 9.6},${87.5} q ${s * 1},1.6 0,3`} stroke={skin.shadow} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.75} />)}
      {d.has('face_paint') &&
        ([-1, 1] as const).map((s) => <rect key={s} x={CX + s * EYE_DX - 5} y={73.5} width={10} height={3.4} rx={1.4} fill="#141519" opacity={0.92} transform={`rotate(${s * -4} ${CX + s * EYE_DX} 75)`} />)}
    </g>
  )
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
  const moustache = <path d={`M ${CX - 9},${88} Q ${CX - 5},${82.5} ${CX},${85} Q ${CX + 5},${82.5} ${CX + 9},${88} Q ${CX},${85.5} ${CX - 9},${88} Z`} fill={col} stroke={shade(col, 0.3)} strokeWidth={0.6} />
  const beard = (heavy: boolean) => (
    <path
      d={`${jaw(0.4, 70)} L ${CX + f.cheek - (heavy ? 7 : 4)},70 C ${CX + 16},${heavy ? 84 : 92} ${CX + 12},${f.chin - (heavy ? 12 : 7)} ${CX},${f.chin - (heavy ? 9 : 5)} C ${CX - 12},${f.chin - (heavy ? 12 : 7)} ${CX - 16},${heavy ? 84 : 92} ${CX - f.cheek + (heavy ? 7 : 4)},70 Z`}
      fill={col}
      stroke={shade(col, 0.3)}
      strokeWidth={0.6}
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
  const line = shade(col, 0.32)
  const f = faceSpec(c.face)
  switch (c.hair) {
    case 'hair_afro':
      return <circle cx={CX} cy={52} r={f.cheek + 15} fill={col} stroke={line} strokeWidth={1} />
    case 'hair_wavy_med':
      return (
        <path
          d={`M ${CX - f.cheek - 8},96 C ${CX - f.cheek - 16},40 ${CX - 10},18 ${CX},22 C ${CX + 10},18 ${CX + f.cheek + 16},40 ${CX + f.cheek + 8},96 Q ${CX},104 ${CX - f.cheek - 8},96 Z`}
          fill={dark}
          stroke={line}
          strokeWidth={1}
        />
      )
    case 'hair_long_straight':
      return (
        <path
          d={`M ${CX - f.cheek - 5},60 C ${CX - f.cheek - 9},18 ${CX + f.cheek + 9},18 ${CX + f.cheek + 5},60 L ${CX + f.cheek + 11},142 Q ${CX},148 ${CX - f.cheek - 11},142 Z`}
          fill={dark}
          stroke={line}
          strokeWidth={1}
        />
      )
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
            const d = `M ${x0},44 C ${x0 + t * 30},70 ${x1},${end - 30} ${x1 + t * 4},${end}`
            return (
              <g key={i}>
                <path d={d} stroke={line} strokeWidth={w + 1.4} strokeLinecap="round" fill="none" />
                <path d={d} stroke={i % 2 ? col : dark} strokeWidth={w} strokeLinecap="round" fill="none" />
              </g>
            )
          })}
        </g>
      )
    }
    case 'hair_ponytail':
      return <path d={`M ${CX + 14},40 C ${CX + 44},36 ${CX + 46},80 ${CX + 36},118 C ${CX + 32},96 ${CX + 30},70 ${CX + 14},56 Z`} fill={col} stroke={line} strokeWidth={1} />
    default:
      return null
  }
}

/** Soft sheen across the crown. */
function Shine({ col, y = 32, w = 16 }: { col: string; y?: number; w?: number }) {
  return <path d={`M ${CX - w},${y + 4} Q ${CX - w * 0.2},${y - 4} ${CX + w * 0.6},${y}`} stroke={shade(col, -0.4)} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.45} />
}

/** Hair on top of the head. */
export function HairFront({ c, skin }: { c: PlayerAvatarConfig; skin: Skin }) {
  const col = hairColor(c)
  const dark = shade(col, 0.28)
  const line = shade(col, 0.32)
  const f = faceSpec(c.face)
  const fill = (d: string, extra?: ReactNode, shine = true) => (
    <g>
      <path d={d} fill={col} stroke={line} strokeWidth={0.9} strokeLinejoin="round" />
      {shine && <Shine col={col} />}
      {extra}
    </g>
  )
  const sleek = (extra?: ReactNode) => fill(cap(f, -3, 63, 48), extra)
  switch (c.hair) {
    case 'hair_buzz':
      return <path d={cap(f, -7, 62, 49)} fill={col} opacity={0.82} />
    case 'hair_fade_low':
    case 'hair_fade_mid':
    case 'hair_fade_high': {
      const sideOpacity = { hair_fade_low: 0.75, hair_fade_mid: 0.45, hair_fade_high: 0.18 }[c.hair]
      return (
        <g>
          <path d={cap(f, -4, 66, 50)} fill={col} opacity={sideOpacity} />
          {fill(cap(f, 2, 52, 49, 0.82))}
        </g>
      )
    }
    case 'hair_crop':
      return fill(cap(f, 3, 60, 50), <path d={`M ${CX - 20},47 l 5,-6 l 4,5 l 5,-6 l 4,5 l 5,-6 l 4,5 l 5,-5 l 4,6`} stroke={dark} strokeWidth={1.6} fill="none" strokeLinejoin="round" />)
    case 'hair_curls_short':
    case 'hair_twists':
      return (
        <g>
          <path d={cap(f, 4, 62, 49)} fill={col} stroke={line} strokeWidth={0.9} />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.08 + (0.84 * i) / 8)
            const x = CX - Math.cos(a) * (f.cheek + 1)
            const y = 42 - Math.sin(a) * 15
            return c.hair === 'hair_curls_short' ? (
              <g key={i}>
                <circle cx={x} cy={y} r={6.5} fill={col} stroke={dark} strokeWidth={0.9} />
                <path d={`M ${x - 2.5},${y - 1.5} q 2.5,-2.5 4,0`} stroke={shade(col, -0.4)} strokeWidth={1} fill="none" opacity={0.5} />
              </g>
            ) : (
              <rect key={i} x={x - 3} y={y - 9} width={6} height={15} rx={3} fill={col} stroke={dark} strokeWidth={0.9} />
            )
          })}
        </g>
      )
    case 'hair_wavy_med':
      return fill(cap(f, 8, 74, 52), <path d={`M ${CX - 4},38 Q ${CX - 18},44 ${CX - f.cheek + 2},62`} stroke={dark} strokeWidth={1.5} fill="none" />)
    case 'hair_afro':
      return (
        <g>
          <path d={cap(f, 8, 60, 50, 1.02)} fill={col} />
          <Shine col={col} y={22} w={22} />
        </g>
      )
    case 'hair_locs':
      return fill(cap(f, 6, 62, 49), <path d={`M ${CX - 14},42 l 2,12 M ${CX - 4},39 l 1,13 M ${CX + 6},39 l -1,13 M ${CX + 15},42 l -2,12`} stroke={dark} strokeWidth={1.6} strokeLinecap="round" />)
    case 'hair_braids':
      return (
        <g>
          {fill(cap(f, -1, 64, 48))}
          <path d={`M ${CX},28 L ${CX},48`} stroke={skin.mid} strokeWidth={1.4} />
          {([-1, 1] as const).map((s) =>
            Array.from({ length: 7 }, (_, i) => (
              <ellipse key={`${s}${i}`} cx={CX + s * (f.cheek + 4) + s * i * 0.6} cy={74 + i * 10} rx={5} ry={6.2} fill={i % 2 ? col : dark} stroke={line} strokeWidth={0.7} />
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
    case 'hair_hightop':
      return (
        <g>
          <path d={cap(f, -4, 66, 50)} fill={col} opacity={0.3} />
          <path
            d={`M ${CX - f.cheek + 1},52 L ${CX - f.cheek - 1},10 Q ${CX},3 ${CX + f.cheek + 1},10 L ${CX + f.cheek - 1},52 Q ${CX},45 ${CX - f.cheek + 1},52 Z`}
            fill={col}
            stroke={line}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          {[-12, -4, 4, 12].map((dx) => (
            <path key={dx} d={`M ${CX + dx},12 L ${CX + dx * 1.05},46`} stroke={dark} strokeWidth={0.8} opacity={0.5} />
          ))}
          <path d={`M ${CX - f.cheek},11 Q ${CX},5 ${CX + f.cheek},11`} stroke={shade(col, -0.4)} strokeWidth={2.4} fill="none" opacity={0.45} />
        </g>
      )
    case 'hair_mohawk':
      return (
        <g>
          <path d={cap(f, -5, 64, 50)} fill={col} opacity={0.22} />
          <path
            d={`M ${CX - 8},50 Q ${CX - 12},22 ${CX - 6},8 L ${CX - 3},14 L ${CX},4 L ${CX + 3},14 L ${CX + 6},8 Q ${CX + 12},22 ${CX + 8},50 Q ${CX},46 ${CX - 8},50 Z`}
            fill={col}
            stroke={line}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
          <path d={`M ${CX - 3},44 Q ${CX - 5},26 ${CX - 2},14`} stroke={shade(col, -0.4)} strokeWidth={1.6} fill="none" opacity={0.45} />
        </g>
      )
    case 'hair_bun':
      return sleek(
        <g>
          <circle cx={CX} cy={19} r={11} fill={col} stroke={line} strokeWidth={0.9} />
          <path d={`M ${CX - 6},16 q 6,-6 12,0`} stroke={shade(col, -0.4)} strokeWidth={1.4} fill="none" opacity={0.5} />
          <rect x={CX - 7} y={27} width={14} height={3.6} rx={1.8} fill={dark} />
        </g>,
      )
    case 'hair_puff':
      return sleek(
        <g>
          <circle cx={CX} cy={14} r={19} fill={col} stroke={line} strokeWidth={0.9} />
          <path d={`M ${CX - 11},8 q 8,-10 18,-2`} stroke={shade(col, -0.4)} strokeWidth={2} fill="none" opacity={0.45} />
          <rect x={CX - 9} y={30} width={18} height={4} rx={2} fill={dark} />
        </g>,
      )
    case 'hair_bantu_knots':
      return (
        <g>
          <path d={cap(f, -3, 63, 48)} fill={col} />
          {[
            [-17, 34],
            [-6, 26],
            [6, 26],
            [17, 34],
            [0, 40],
          ].map(([dx, y]) => (
            <g key={`${dx}${y}`}>
              <circle cx={CX + dx} cy={y - 4} r={6.6} fill={col} stroke={line} strokeWidth={0.9} />
              <path d={`M ${CX + dx - 3.5},${y - 4} a 3.5,3.5 0 1 1 3.5,3.5`} stroke={dark} strokeWidth={1} fill="none" />
            </g>
          ))}
          <path d={`M ${CX - 11},30 L ${CX - 11},48 M ${CX + 11},30 L ${CX + 11},48 M ${CX - 20},44 L ${CX + 20},44`} stroke={skin.mid} strokeWidth={1} opacity={0.7} />
        </g>
      )
    case 'hair_pixie':
      return fill(
        cap(f, 1, 62, 50),
        <path d={`M ${CX - f.cheek},58 Q ${CX - 8},38 ${CX + f.cheek - 2},50 Q ${CX + 4},46 ${CX - f.cheek + 6},62 Z`} fill={col} stroke={line} strokeWidth={0.9} strokeLinejoin="round" />,
      )
    case 'hair_long_straight':
      return (
        <g>
          {fill(cap(f, 2, 62, 49))}
          <path d={`M ${CX},26 L ${CX},46`} stroke={dark} strokeWidth={1.2} />
          {([-1, 1] as const).map((s) => (
            <path
              key={s}
              d={`M ${CX + s * (f.cheek + 2)},52 Q ${CX + s * (f.cheek + 4)},80 ${CX + s * (f.cheek + 1)},108 L ${CX + s * (f.cheek - 5)},108 Q ${CX + s * (f.cheek - 3)},78 ${CX + s * (f.cheek - 8)},54 Z`}
              fill={col}
              stroke={line}
              strokeWidth={0.9}
              strokeLinejoin="round"
            />
          ))}
        </g>
      )
    case 'hair_headwrap': {
      const kit = kitOf(c)
      const fabric = kit.accent
      return (
        <g>
          <path d={`M ${CX - f.cheek - 3},58 C ${CX - f.cheek - 10},10 ${CX + f.cheek + 10},10 ${CX + f.cheek + 3},58 Q ${CX},48 ${CX - f.cheek - 3},58 Z`} fill={fabric} stroke={outlineOf(fabric)} strokeWidth={1} />
          <ellipse cx={CX + 6} cy={14} rx={13} ry={9} fill={fabric} stroke={outlineOf(fabric)} strokeWidth={1} transform={`rotate(-14 ${CX + 6} 14)`} />
          <path d={`M ${CX - 18},48 Q ${CX - 4},26 ${CX + 18},22 M ${CX - 22},38 Q ${CX - 6},18 ${CX + 16},14`} stroke={shade(fabric, 0.2)} strokeWidth={1.4} fill="none" />
          {[
            [-12, 40],
            [-2, 32],
            [10, 30],
            [16, 42],
            [2, 44],
            [-18, 50],
            [8, 12],
          ].map(([dx, y]) => (
            <circle key={`${dx}${y}`} cx={CX + dx} cy={y} r={1.7} fill={kit.trim} opacity={0.85} />
          ))}
        </g>
      )
    }
    default:
      return fill(cap(f, 0, 62, 50))
  }
}

export function Headwear({ c }: { c: PlayerAvatarConfig }) {
  if (!c.headwear) return null
  const kit = kitOf(c)
  const f = faceSpec(c.face)
  const band = kit.accent
  switch (c.headwear) {
    case 'head_cap':
      return (
        <g>
          <path d={`M ${CX - f.cheek - 3},56 C ${CX - f.cheek - 4},16 ${CX + f.cheek + 4},16 ${CX + f.cheek + 3},56 Z`} fill={band} stroke={outlineOf(band)} strokeWidth={1} />
          <path d={`M ${CX - 14},28 Q ${CX - 6},22 ${CX + 2},24`} stroke={shade(band, -0.35)} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.5} />
          <path d={`M ${CX - f.cheek - 2},54 Q ${CX},44 ${CX + f.cheek + 18},56 Q ${CX + 8},62 ${CX - f.cheek - 2},58 Z`} fill={shade(band, 0.18)} stroke={outlineOf(band)} strokeWidth={0.8} />
          <circle cx={CX} cy={24} r={2} fill={shade(band, 0.25)} />
          <path d={`M ${CX - 10},40 L ${CX + 10},40`} stroke={kit.trim} strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
        </g>
      )
    case 'head_headband':
      return (
        <path
          d={`M ${CX - f.cheek - 1.5},52 Q ${CX},42 ${CX + f.cheek + 1.5},52 L ${CX + f.cheek + 1.5},59 Q ${CX},49 ${CX - f.cheek - 1.5},59 Z`}
          fill={band}
          stroke={outlineOf(band)}
          strokeWidth={0.8}
        />
      )
    case 'head_bandana':
      return (
        <g>
          <path d={`M ${CX - f.cheek - 2},54 C ${CX - f.cheek - 2},20 ${CX + f.cheek + 2},20 ${CX + f.cheek + 2},54 Q ${CX},44 ${CX - f.cheek - 2},54 Z`} fill={band} stroke={outlineOf(band)} strokeWidth={0.9} />
          <path d={`M ${CX + f.cheek},50 l 10,4 l -6,6 Z M ${CX + f.cheek},50 l 12,-4 l -2,8 Z`} fill={shade(band, 0.15)} />
          {[
            [-8, 34],
            [6, 30],
            [14, 42],
            [-16, 44],
          ].map(([dx, y]) => (
            <circle key={`${dx}${y}`} cx={CX + dx} cy={y} r={1.6} fill="#ffffff" opacity={0.7} />
          ))}
        </g>
      )
    default:
      return null
  }
}

export function Eyewear({ c, uid }: { c: PlayerAvatarConfig; uid: string }) {
  if (!c.eyewear) return null
  if (c.eyewear === 'eye_sport') {
    const grad = `${uid}-shade`
    return (
      <g>
        <defs>
          <linearGradient id={grad} x1="0" x2="1">
            <stop offset="0" stopColor="#ff5a1f" />
            <stop offset="0.5" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path
          d={`M ${CX - 22},64 Q ${CX},60 ${CX + 22},64 L ${CX + 20},72 Q ${CX + 12},76 ${CX + 3},72 L ${CX},70 L ${CX - 3},72 Q ${CX - 12},76 ${CX - 20},72 Z`}
          fill={`url(#${grad})`}
          stroke={INK}
          strokeWidth={1}
        />
        <path d={`M ${CX - 16},65 L ${CX - 8},64`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
      </g>
    )
  }
  const sun = c.eyewear === 'eye_sunglasses'
  return (
    <g>
      <g fill={sun ? '#1b1d22' : 'none'} stroke={INK} strokeWidth={1.6}>
        {([-1, 1] as const).map((s) => (
          <rect key={s} x={CX + s * EYE_DX - 7.5} y={EYE_Y - 5.5} width={15} height={11} rx={4.5} fillOpacity={sun ? 0.92 : 0} />
        ))}
        <path d={`M ${CX - 3.5},${EYE_Y - 1} Q ${CX},${EYE_Y - 3} ${CX + 3.5},${EYE_Y - 1}`} fill="none" />
      </g>
      {([-1, 1] as const).map((s) => (
        <path key={s} d={`M ${CX + s * EYE_DX - 4.5},${EYE_Y - 2.5} l 2.5,-1.4`} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={sun ? 0.7 : 0.5} />
      ))}
    </g>
  )
}
