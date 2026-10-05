import type { PlayerAvatarConfig } from '../../schema'
import { skinColors } from '../../colors'
import { Arms, Bottoms, Legs, Neck, Top } from './body'
import { CX, geometry, Y } from './geometry'
import { BodyAccessory, Earrings, Equipment } from './gear'
import { Brows, Eyes, Eyewear, Face, FacialHair, HairBack, HairFront, Headwear, Mouth, Nose } from './head'
import { FULL_FIGURE_VIEWBOX, HEAD_PORTRAIT_VIEWBOX } from './viewBox'

const HEAD_SCALE = `translate(${CX} 98) scale(1.14) translate(${-CX} -98)`

/** Taller players are drawn a little bigger, anchored at the feet. */
function heightScale(h: number) {
  const t = Math.min(1, Math.max(0, (h - 1.45) / 0.8))
  return 0.93 + t * 0.14
}

export function AthleteSvgScene({
  config: c,
  crop,
  silhouette,
}: {
  config: PlayerAvatarConfig
  crop: 'full' | 'head'
  silhouette?: boolean
}) {
  const full = crop === 'full'
  const g = geometry(c.bodyType)
  const skin = skinColors(c.skinTone)
  const raised = c.pose === 'action'
  const s = full ? heightScale(c.height) : 1

  return (
    <svg
      viewBox={full ? FULL_FIGURE_VIEWBOX : HEAD_PORTRAIT_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
      role="img"
      aria-label="Player avatar"
      style={silhouette ? { filter: 'brightness(0)', opacity: 0.75 } : undefined}
    >
      {full && <ellipse cx={CX} cy={Y.sole + 2} rx={46 * s} ry={5} fill="#000" opacity={0.12} />}
      <g transform={s === 1 ? undefined : `translate(${CX} ${Y.sole}) scale(${s}) translate(${-CX} ${-Y.sole})`}>
        <g transform={HEAD_SCALE}>
          <HairBack c={c} />
        </g>
        <Legs c={c} g={g} skin={skin} />
        <Bottoms c={c} g={g} />
        <Arms g={g} skin={skin} raised={raised} />
        <Neck g={g} skin={skin} />
        <Top c={c} g={g} raised={raised} />
        <BodyAccessory c={c} g={g} raised={raised} />
        {/* Slightly oversized head — reads better at profile-picture sizes. */}
        <g transform={HEAD_SCALE}>
          <Face c={c} skin={skin} />
          <FacialHair c={c} />
          <Eyes c={c} />
          <Brows c={c} />
          <Nose c={c} skin={skin} />
          <Mouth c={c} />
          <HairFront c={c} skin={skin} />
          <Headwear c={c} />
          <Eyewear c={c} />
          <Earrings c={c} />
        </g>
        {full && <Equipment c={c} g={g} raised={raised} />}
      </g>
    </svg>
  )
}
