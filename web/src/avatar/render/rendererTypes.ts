import type React from 'react'
import type { PlayerAvatarConfig } from '../schema'

export type AvatarCrop = 'full' | 'head'

export type AvatarRenderProps = {
  config: PlayerAvatarConfig
  rotationY?: number
  crop?: AvatarCrop
  className?: string
  /** Dev: render solid silhouette to validate proportions */
  silhouette?: boolean
  /** Studio uses 3D; profile chips keep SVG unless env says glb */
  renderer?: 'svg' | 'glb'
}

export type AvatarRenderer = (props: AvatarRenderProps) => React.ReactElement
