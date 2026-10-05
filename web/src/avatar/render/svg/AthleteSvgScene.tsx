import type { PlayerAvatarConfig } from '../../schema'
import { FULL_FIGURE_VIEWBOX, HEAD_PORTRAIT_VIEWBOX } from './viewBox'
import { ReferenceHooperFigure } from './premium/ReferenceHooperFigure'

export function AthleteSvgScene({
  config,
  crop,
  silhouette,
}: {
  config: PlayerAvatarConfig
  crop: 'full' | 'head'
  silhouette?: boolean
}) {
  const showBody = crop === 'full'

  return (
    <svg
      viewBox={showBody ? FULL_FIGURE_VIEWBOX : HEAD_PORTRAIT_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className="block h-full w-full"
      role="img"
      aria-label="Sports player avatar"
    >
      {showBody && <ellipse cx="180" cy="578" rx="58" ry="7" fill="#000" opacity={silhouette ? 0.18 : 0.1} />}
      <ReferenceHooperFigure config={config} showBody={showBody} silhouette={silhouette} />
    </svg>
  )
}
