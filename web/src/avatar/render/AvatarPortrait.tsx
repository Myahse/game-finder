import { useMemo } from 'react'
import type { PlayerAvatarConfig } from '../schema'
import { avataaarsSvg } from './avataaars'
import { currentT } from '../../i18n/LocaleProvider'

/** A player's illustrated portrait, scaled to fill its box. */
export function AvatarPortrait({ config, className = '' }: { config: PlayerAvatarConfig; className?: string }) {
  const svg = useMemo(() => avataaarsSvg(config), [config])
  return (
    <div
      role="img"
      // Rendered app-wide (also outside the provider in tests), so read strings at render time.
      aria-label={currentT().avatarLabels.portrait}
      className={`[&>svg]:block [&>svg]:h-full [&>svg]:w-full ${className}`}
      // Markup comes from the bundled Avataaars art and our own option ids — no user-supplied strings.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
