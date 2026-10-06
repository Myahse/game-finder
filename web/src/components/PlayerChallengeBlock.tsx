import { useLocale } from '../i18n/LocaleProvider'
import { useHeadToHead } from '../lib/challenges'
import { playerUsernameLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { ChallengeButton } from './ChallengeComposer'

/** On another player's profile: challenge them + our head-to-head record. */
export function PlayerChallengeBlock({ player }: { player: PublicUser }) {
  const { t } = useLocale()
  const { data } = useHeadToHead(player.id)
  const name = playerUsernameLabel(player)
  return (
    <div className="grid gap-1.5">
      <ChallengeButton opponent={player} className="w-full" />
      {data && (
        <p className="text-center text-sm font-semibold text-ink-2">
          {data.played > 0 ? t.challenge.h2h.replace('{user}', name).replace('{w}', String(data.wins)).replace('{l}', String(data.losses)) : t.challenge.h2hNone.replace('{user}', name)}
        </p>
      )}
    </div>
  )
}
