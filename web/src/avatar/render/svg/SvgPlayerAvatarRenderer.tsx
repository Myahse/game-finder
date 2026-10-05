import type { AvatarRenderProps } from '../rendererTypes'
import { AthleteSvgScene } from './AthleteSvgScene'

export function SvgPlayerAvatarRenderer({
  config,
  rotationY = 0,
  crop = 'full',
  className = '',
  silhouette,
}: AvatarRenderProps) {
  const rotate = rotationY % 360
  return (
    <div className={`flex h-full w-full items-center justify-center ${className}`}>
      <div
        className="h-full w-full max-w-full"
        style={{
          transform: rotate ? `perspective(900px) rotateY(${rotate}deg)` : undefined,
          transformOrigin: 'center center',
          transition: 'transform 0.35s ease',
        }}
      >
        <AthleteSvgScene config={config} crop={crop} silhouette={silhouette} />
      </div>
    </div>
  )
}
