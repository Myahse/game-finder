import type { PlayerAvatarConfig } from '../../schema'
import { armJoints, CX, faceSpec, type Geo, kitOf, Y } from './geometry'
import { INK, shade } from './palette'

const GOLD = '#d9a63a'

function along(a: readonly [number, number], b: readonly [number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const
}

/** Wristbands, watch and necklace (earrings are drawn with the head). */
export function BodyAccessory({ c, g, raised }: { c: PlayerAvatarConfig; g: Geo; raised: boolean }) {
  const kit = kitOf(c)
  if (c.accessory === 'acc_necklace') {
    return (
      <g fill="none">
        <path d={`M ${CX - g.neck - 2},${Y.shoulder - 6} Q ${CX},${Y.shoulder + 20} ${CX + g.neck + 2},${Y.shoulder - 6}`} stroke={GOLD} strokeWidth={1.6} />
        <circle cx={CX} cy={Y.shoulder + 13} r={2.6} fill={GOLD} />
      </g>
    )
  }
  if (c.accessory === 'acc_wristbands' || c.accessory === 'acc_watch') {
    const sides = c.accessory === 'acc_watch' ? ([1] as const) : ([-1, 1] as const)
    return (
      <g>
        {sides.map((side) => {
          const j = armJoints(g, side, raised && side === -1)
          const a = along(j.elbow, j.wrist, 0.72)
          const b = along(j.elbow, j.wrist, 0.94)
          const band = c.accessory === 'acc_watch' ? '#202227' : kit.accent
          return (
            <g key={side}>
              <path d={`M ${a.join(',')} L ${b.join(',')}`} stroke={band} strokeWidth={g.arm + 2.5} strokeLinecap="butt" />
              {c.accessory === 'acc_watch' && <circle cx={(a[0] + b[0]) / 2} cy={(a[1] + b[1]) / 2} r={3.6} fill="#d7dde4" stroke="#202227" strokeWidth={1} />}
            </g>
          )
        })}
      </g>
    )
  }
  return null
}

export function Earrings({ c }: { c: PlayerAvatarConfig }) {
  if (c.accessory !== 'acc_earrings') return null
  const f = faceSpec(c.face)
  return (
    <g>
      {([-1, 1] as const).map((s) => (
        <circle key={s} cx={CX + s * (f.cheek + 1.5)} cy={79.5} r={2} fill={GOLD} stroke={shade(GOLD, 0.3)} strokeWidth={0.6} />
      ))}
    </g>
  )
}

function Ball({ x, y, kind }: { x: number; y: number; kind: string }) {
  if (kind === 'eq_basketball') {
    return (
      <g>
        <circle cx={x} cy={y} r={13} fill="#e7702c" stroke="#7a3410" strokeWidth={1} />
        <path d={`M ${x - 13},${y} L ${x + 13},${y} M ${x},${y - 13} L ${x},${y + 13} M ${x - 9},${y - 9} Q ${x - 3},${y} ${x - 9},${y + 9} M ${x + 9},${y - 9} Q ${x + 3},${y} ${x + 9},${y + 9}`} stroke="#5a2508" strokeWidth={1.2} fill="none" />
      </g>
    )
  }
  if (kind === 'eq_volleyball') {
    return (
      <g>
        <circle cx={x} cy={y} r={12.5} fill="#f7d33c" stroke="#1e3a8a" strokeWidth={1} />
        <path d={`M ${x - 12},${y + 3} Q ${x},${y - 1} ${x + 11},${y + 6} M ${x - 3},${y - 12} Q ${x + 3},${y - 2} ${x - 5},${y + 11} M ${x + 6},${y - 11} Q ${x + 2},${y - 4} ${x + 12},${y - 2}`} stroke="#1e3a8a" strokeWidth={1.4} fill="none" />
      </g>
    )
  }
  return (
    <g>
      <circle cx={x} cy={y} r={12} fill="#fbfaf7" stroke={INK} strokeWidth={1} />
      <path d={`M ${x},${y - 4.5} l 4.3,3.1 -1.6,5 h -5.4 l -1.6,-5 Z`} fill={INK} />
      <path d={`M ${x},${y - 4.5} L ${x},${y - 12} M ${x + 4.3},${y - 1.4} L ${x + 11.5},${y - 3.5} M ${x + 2.7},${y + 3.6} L ${x + 7},${y + 9.6} M ${x - 2.7},${y + 3.6} L ${x - 7},${y + 9.6} M ${x - 4.3},${y - 1.4} L ${x - 11.5},${y - 3.5}`} stroke={INK} strokeWidth={1} />
    </g>
  )
}

function Racket({ x, y, tennis, raised }: { x: number; y: number; tennis: boolean; raised: boolean }) {
  const len = tennis ? 18 : 22
  const rx = tennis ? 11 : 8
  const ry = tennis ? 14 : 10.5
  const frame = tennis ? '#7c3aed' : '#0d9488'
  const angle = raised ? -18 : -28
  return (
    <g transform={`rotate(${angle} ${x} ${y})`}>
      <rect x={x - 2.2} y={y - len} width={4.4} height={len + 6} rx={2} fill="#2a2c33" />
      <ellipse cx={x} cy={y - len - ry} rx={rx} ry={ry} fill="#ffffff" fillOpacity={0.25} stroke={frame} strokeWidth={2.6} />
      <g stroke={frame} strokeWidth={0.5} opacity={0.6}>
        {[-0.6, -0.3, 0, 0.3, 0.6].map((t) => (
          <path key={`v${t}`} d={`M ${x + t * rx},${y - len - ry * 1.9} L ${x + t * rx},${y - len - ry * 0.1}`} />
        ))}
        {[-0.6, -0.3, 0, 0.3, 0.6].map((t) => (
          <path key={`h${t}`} d={`M ${x - rx * 0.95},${y - len - ry + t * ry} L ${x + rx * 0.95},${y - len - ry + t * ry}`} />
        ))}
      </g>
      {tennis ? (
        <circle cx={x + rx + 8} cy={y - len - ry - 10} r={4.2} fill="#d9f03a" />
      ) : (
        <g transform={`translate(${x + rx + 8},${y - len - ry - 12}) rotate(30)`}>
          <path d="M -1.4,0 L -4.5,-9 L 4.5,-9 L 1.4,0 Z" fill="#ffffff" stroke="#b6bcc4" strokeWidth={0.5} />
          <circle cy={1.4} r={2} fill="#f2efe8" />
        </g>
      )}
    </g>
  )
}

/** Sports equipment held in the figure's right hand (viewer's left). */
export function Equipment({ c, g, raised }: { c: PlayerAvatarConfig; g: Geo; raised: boolean }) {
  const kind = c.sportsEquipment
  if (!kind) return null
  const j = armJoints(g, -1, raised)
  const handR = g.arm * 0.56
  const hx = j.wrist[0]
  const hy = j.wrist[1] + (raised ? -handR * 0.7 : handR * 0.7)
  switch (kind) {
    case 'eq_basketball':
    case 'eq_football':
    case 'eq_volleyball':
      return raised ? <Ball x={hx + 2} y={hy - 18} kind={kind} /> : <Ball x={hx - 9} y={hy + 9} kind={kind} />
    case 'eq_tennis_racket':
    case 'eq_badminton_racket':
      return <Racket x={hx} y={hy} tennis={kind === 'eq_tennis_racket'} raised={raised} />
    case 'eq_water_bottle':
      return (
        <g>
          <rect x={hx - 5} y={hy - 14} width={10} height={24} rx={3} fill="#38bdf8" fillOpacity={0.85} stroke="#0c4a6e" strokeWidth={0.8} />
          <rect x={hx - 3.5} y={hy - 19} width={7} height={6} rx={1.5} fill="#1d1f2b" />
          <circle cx={hx} cy={hy} r={handR} fill="none" />
        </g>
      )
    case 'eq_dumbbells':
      return (
        <g>
          <rect x={hx - 11} y={hy - 1.8} width={22} height={3.6} rx={1.5} fill="#6b7280" />
          <rect x={hx - 15} y={hy - 7} width={6} height={14} rx={2} fill="#1f2329" />
          <rect x={hx + 9} y={hy - 7} width={6} height={14} rx={2} fill="#1f2329" />
        </g>
      )
    default:
      return null
  }
}
