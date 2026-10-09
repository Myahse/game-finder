import { useMemo, type CSSProperties, type PointerEvent } from 'react'
import type { PlayerAvatarConfig } from '../schema'
import { avataaarsSvg } from './avataaars'
import { idleDelay } from '../../lib/motion'
import { currentT } from '../../i18n/LocaleProvider'

/** A player's illustrated portrait, scaled to fill its box. */
/**
 * With [live] (the default) the portrait idles: a slow breath, a blink at its own
 * rhythm, and a hop when pointed at or tapped.
 */
export function AvatarPortrait({ config, className = '', live = true }: { config: PlayerAvatarConfig; className?: string; live?: boolean }) {
  const svg = useMemo(() => avataaarsSvg(config), [config])
  const delay = useMemo(() => idleDelay(svg), [svg])
  return (
    <div
      role="img"
      // Rendered app-wide (also outside the provider in tests), so read strings at render time.
      aria-label={currentT().avatarLabels.portrait}
      className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${live ? 'ftg-av-live' : ''} ${className}`}
      style={live ? ({ '--ftg-av-delay': `${delay}ms` } as CSSProperties) : undefined}
      onPointerDown={live ? hop : undefined}
      // Markup comes from the bundled Avataaars art and our own option ids — no user-supplied strings.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** Hop on tap or click (phones don't apply :active to a plain picture). */
function hop(e: PointerEvent<HTMLDivElement>) {
  const el = e.currentTarget
  el.removeAttribute('data-hop')
  void el.offsetWidth // restart the animation on quick repeat taps
  el.setAttribute('data-hop', '')
  window.setTimeout(() => el.removeAttribute('data-hop'), 550)
}
