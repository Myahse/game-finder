import type { AvatarRenderProps } from '../rendererTypes'
import { PlayerAvatar3D } from '../three/PlayerAvatar3D'

export function GlbPlayerAvatarRenderer({ config, className = '' }: AvatarRenderProps) {
  return <PlayerAvatar3D config={config} className={className} interactive />
}
