import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { AvatarRenderProps } from './rendererTypes'
import { avatarRendererMode } from './avatarRendererMode'
import { SvgPlayerAvatarRenderer } from './svg/SvgPlayerAvatarRenderer'

const GlbPlayerAvatarRenderer = lazy(() =>
  import('./glb/GlbPlayerAvatarRenderer').then((m) => ({ default: m.GlbPlayerAvatarRenderer })),
)

/** A failed 3D load (missing GLB, no WebGL, blocked network) falls back to the 2D avatar instead of crashing the page. */
class FallbackOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function PlayerAvatarRenderer(props: AvatarRenderProps) {
  const mode = props.renderer ?? avatarRendererMode()
  if (mode === 'glb') {
    const fallback = <SvgPlayerAvatarRenderer {...props} />
    return (
      <FallbackOnError fallback={fallback}>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-ink-2">Loading 3D…</div>}>
          <GlbPlayerAvatarRenderer {...props} />
        </Suspense>
      </FallbackOnError>
    )
  }
  return <SvgPlayerAvatarRenderer {...props} />
}
