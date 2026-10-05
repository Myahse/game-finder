import { useMemo } from 'react'
import type { PlayerAvatarConfig } from '../schema'
import { avataaarsSvg } from './avataaars'

/** A player's illustrated portrait, scaled to fill its box. */
export function AvatarPortrait({ config, className = '' }: { config: PlayerAvatarConfig; className?: string }) {
  const svg = useMemo(() => avataaarsSvg(config), [config])
  return (
    <div
      role="img"
      aria-label="Player avatar"
      className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      // Markup comes from the bundled Avataaars art and our own option ids — no user-supplied strings.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
