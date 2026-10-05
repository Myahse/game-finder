import type { PlayerAvatarConfig } from '../schema'
import { PlayerAvatarRenderer } from '../render/PlayerAvatarRenderer'

const SIZES = { sm: 40, md: 64, lg: 96, xl: 140 } as const

export function PlayerAvatar({
  config,
  size = 'md',
  crop = 'head',
  rotationY = 0,
  className = '',
}: {
  config: PlayerAvatarConfig
  size?: keyof typeof SIZES | number
  crop?: 'full' | 'head'
  rotationY?: number
  className?: string
}) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const h = crop === 'head' ? px : Math.round(px * 1.55)
  return (
    <div
      className={`overflow-hidden ${crop === 'head' ? 'rounded-full bg-gradient-to-b from-[#eef2f6] to-[#dfe6ed]' : 'rounded-2xl bg-gradient-to-b from-[#eef2f6] to-[#dfe6ed]'} ${className}`}
      style={{ width: px, height: h }}
    >
      <PlayerAvatarRenderer
        config={config}
        crop={crop}
        rotationY={rotationY}
        className="h-full w-full"
      />
    </div>
  )
}
