export type AvatarRendererMode = 'svg' | 'glb'

/** `VITE_AVATAR_RENDERER=glb` enables Three.js GLB pipeline. Default: svg (legacy). */
export function avatarRendererMode(): AvatarRendererMode {
  const v = import.meta.env.VITE_AVATAR_RENDERER
  if (v === 'glb' || v === 'three') return 'glb'
  return 'svg'
}
