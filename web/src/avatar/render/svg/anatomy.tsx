import { useId } from 'react'
import type { Skin } from './geometry'
import type { Pt } from './limbs'
import { shade } from './palette'

const outlineOf = (hex: string) => shade(hex, 0.38)

/**
 * Draws a set of overlapping shapes as one form: a single outline around the union,
 * a core shadow on the far (right) side and a soft highlight on the near side.
 */
export function Flesh({ pieces, color, depth = 4, highlight = true }: { pieces: string[]; color: string; depth?: number; highlight?: boolean }) {
  const id = useId().replace(/:/g, '')
  const shadowMask = `${id}-s`
  const lightMask = `${id}-l`
  return (
    <g>
      <defs>
        <mask id={shadowMask} maskUnits="userSpaceOnUse" x={-40} y={-80} width={320} height={520}>
          {pieces.map((d, i) => (
            <path key={i} d={d} fill="#fff" />
          ))}
          <g transform={`translate(${-depth} 0)`}>
            {pieces.map((d, i) => (
              <path key={i} d={d} fill="#000" />
            ))}
          </g>
        </mask>
        {highlight && (
          <mask id={lightMask} maskUnits="userSpaceOnUse" x={-40} y={-80} width={320} height={520}>
            {pieces.map((d, i) => (
              <path key={i} d={d} fill="#fff" />
            ))}
            <g transform={`translate(${depth * 0.55} 0)`}>
              {pieces.map((d, i) => (
                <path key={i} d={d} fill="#000" />
              ))}
            </g>
          </mask>
        )}
      </defs>
      <g fill={outlineOf(color)} stroke={outlineOf(color)} strokeWidth={2.2} strokeLinejoin="round">
        {pieces.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={color}>
        {pieces.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <rect x={-40} y={-80} width={320} height={520} fill={shade(color, 0.22)} mask={`url(#${shadowMask})`} opacity={0.6} />
      {highlight && <rect x={-40} y={-80} width={320} height={520} fill={shade(color, -0.3)} mask={`url(#${lightMask})`} opacity={0.4} />}
    </g>
  )
}

/**
 * A relaxed hand with four fingers and a thumb, oriented along the forearm.
 * `inner` is the global x direction toward the body (where the thumb sits).
 */
export function Hand({ elbow, wrist, size, skin, inner }: { elbow: Pt; wrist: Pt; size: number; skin: Skin; inner: -1 | 1 }) {
  const dx = wrist[0] - elbow[0]
  const dy = wrist[1] - elbow[1]
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 90
  // Local +x maps to global +x when the hand hangs down, and flips when raised.
  const flip = Math.cos((angle * Math.PI) / 180) >= 0 ? 1 : -1
  const t = inner * flip
  const u = size
  const line = outlineOf(skin.base)
  const fingers: [number, number][] = [
    [-0.5, 0.72],
    [-0.17, 0.92],
    [0.17, 0.88],
    [0.5, 0.68],
  ]
  return (
    <g transform={`translate(${wrist[0]} ${wrist[1]}) rotate(${angle})`}>
      {/* outline pass */}
      <g stroke={line} strokeLinecap="round" fill={line}>
        <path d={`M ${-0.72 * u},0 C ${-0.82 * u},${0.6 * u} ${-0.78 * u},${1.12 * u} ${-0.55 * u},${1.32 * u} L ${0.58 * u},${1.32 * u} C ${0.8 * u},${1.1 * u} ${0.82 * u},${0.6 * u} ${0.72 * u},0 Z`} strokeWidth={2} />
        {fingers.map(([x, l], i) => (
          <path key={i} d={`M ${x * u},${1.15 * u} L ${(x * 0.9) * u},${(1.15 + l) * u}`} strokeWidth={0.36 * u + 2} fill="none" />
        ))}
        <path d={`M ${t * 0.62 * u},${0.42 * u} L ${t * 0.98 * u},${1.08 * u}`} strokeWidth={0.4 * u + 2} fill="none" />
      </g>
      {/* skin pass */}
      <g stroke={skin.base} strokeLinecap="round" fill={skin.base}>
        <path d={`M ${-0.72 * u},0 C ${-0.82 * u},${0.6 * u} ${-0.78 * u},${1.12 * u} ${-0.55 * u},${1.32 * u} L ${0.58 * u},${1.32 * u} C ${0.8 * u},${1.1 * u} ${0.82 * u},${0.6 * u} ${0.72 * u},0 Z`} strokeWidth={0.1} />
        {fingers.map(([x, l], i) => (
          <path key={i} d={`M ${x * u},${1.15 * u} L ${(x * 0.9) * u},${(1.15 + l) * u}`} strokeWidth={0.36 * u} fill="none" />
        ))}
        <path d={`M ${t * 0.62 * u},${0.42 * u} L ${t * 0.98 * u},${1.08 * u}`} strokeWidth={0.4 * u} fill="none" />
      </g>
      {/* finger separation, knuckles, nails-side shading */}
      <g stroke={skin.shadow} strokeLinecap="round" fill="none">
        {[-0.33, 0, 0.33].map((x) => (
          <path key={x} d={`M ${x * u},${1.36 * u} L ${x * 0.92 * u},${1.86 * u}`} strokeWidth={0.7} opacity={0.75} />
        ))}
        <path d={`M ${-0.55 * u},${1.18 * u} Q 0,${1.32 * u} ${0.55 * u},${1.18 * u}`} strokeWidth={0.7} opacity={0.5} />
        <path d={`M ${0.55 * u * -t},${0.2 * u} Q ${0.62 * u * -t},${0.7 * u} ${0.5 * u * -t},${1.15 * u}`} strokeWidth={0.32 * u} opacity={0.22} />
      </g>
    </g>
  )
}
