import { lazy, Suspense } from 'react'
import type { AvatarRenderProps } from './rendererTypes'
import { avatarRendererMode } from './avatarRendererMode'
import { SvgPlayerAvatarRenderer } from './svg/SvgPlayerAvatarRenderer'

const GlbPlayerAvatarRenderer = lazy(() =>
  import('./glb/GlbPlayerAvatarRenderer').then((m) => ({ default: m.GlbPlayerAvatarRenderer })),
)

export function PlayerAvatarRenderer(props: AvatarRenderProps) {
  const mode = props.renderer ?? avatarRendererMode()
  if (mode === 'glb') {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-ink-2">Loading 3D…</div>}>
        <GlbPlayerAvatarRenderer {...props} />
      </Suspense>
    )
  }
  return <SvgPlayerAvatarRenderer {...props} />
}
