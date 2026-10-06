import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { AvatarRenderProps } from './rendererTypes'
import { avatarRendererMode } from './avatarRendererMode'
import { AvatarPortrait } from './AvatarPortrait'
import { useLocale } from '../../i18n/LocaleProvider'

const GlbPlayerAvatarRenderer = lazy(() =>
  import('./glb/GlbPlayerAvatarRenderer').then((m) => ({ default: m.GlbPlayerAvatarRenderer })),
)

/** A failed 3D load (missing GLB, no WebGL, blocked network) falls back to the 2D portrait instead of crashing the page. */
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
  const { t } = useLocale()
  const portrait = <AvatarPortrait config={props.config} className={`h-full w-full ${props.className ?? ''}`} />
  if ((props.renderer ?? avatarRendererMode()) === 'glb') {
    return (
      <FallbackOnError fallback={portrait}>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-ink-2">{t.avatarLabels.loading3d}</div>}>
          <GlbPlayerAvatarRenderer {...props} />
        </Suspense>
      </FallbackOnError>
    )
  }
  return portrait
}
