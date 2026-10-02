import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { subscribeLiveGamePulse } from '../lib/liveGames'
import { useLocation } from '../lib/location'
import { useBrowseSportSlug, useMySport } from '../lib/mySport'
import { useGamesNearby, useSports } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { useQueryErrorToast } from '../lib/toastErrors'
import { sortPlayable } from '../lib/sort'
import { GameCard } from '../components/GameCard'
import { BasketballIcon, LiveText, SportName } from '../components/icons'
import { Chip, Empty, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'

/** Live games nearby, closest → liveliest → most room. */
export function PlayPage() {
  const [pulseIds, setPulseIds] = useState<Set<string>>(() => new Set())
  useEffect(() => subscribeLiveGamePulse(setPulseIds), [])

  const [, setParams] = useSearchParams()
  const { user } = useAuth()
  const sport = useBrowseSportSlug()
  const mySport = useMySport()
  const isAdmin = user?.role === 'admin'
  const { center, status, waitingGps, hasFix } = useLocation()
  const { data: sports } = useSports()
  const { data: games, isLoading, isError, error } = useGamesNearby(center, sport)
  useQueryErrorToast(error)
  useQueryErrorToast(error)
  const sorted = sortPlayable(games ?? [])
  const live = sorted.filter((g) => g.status === 'active')
  const soon = sorted.filter((g) => g.status === 'scheduled')

  return (
    <div className="pb-10">
      <PageHeader title="Play" back="/" />
      <div className="mx-auto max-w-2xl p-4">
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {isAdmin ? (
            <>
              <Chip active={!sport} onClick={() => setParams({}, { replace: true })}>
                All
              </Chip>
              {sports
                ?.filter((s) => s.active)
                .map((s) => (
                  <Chip key={s.id} active={sport === s.slug} onClick={() => setParams({ sport: s.slug }, { replace: true })}>
                    <SportName sport={s} />
                  </Chip>
                ))}
            </>
          ) : (
            mySport && (
              <Chip active>
                <SportName sport={mySport} />
              </Chip>
            )
          )}
        </div>
        {waitingGps && (
          <p className="mb-3 text-sm text-ink-2">
            Finding your location… Showing games near Grand-Bassam until GPS is ready.
          </p>
        )}
        {!hasFix && status === 'denied' && (
          <p className="mb-3 text-sm text-ink-2">Distances are from Grand-Bassam — allow location for yours.</p>
        )}

        {isError && (
          <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error instanceof Error ? error.message : 'Could not load games.'}
          </p>
        )}

        {isLoading ? (
          <Loading />
        ) : sorted.length === 0 ? (
          <Empty icon={<BasketballIcon className="size-14" />} title="No games nearby yet">
            Be the one who starts it.{' '}
            <Link to="/games/new" className="font-semibold text-brand">
              Create a game
            </Link>
          </Empty>
        ) : (
          <>
            {live.length > 0 && (
              <section>
                <h2 className="display mb-2 inline-flex items-center gap-2 text-2xl font-bold">
                  <LiveText>Playing now</LiveText>
                </h2>
                <div className="grid gap-2">
                  {live.map((g) => (
                    <div key={g.id} className={pulseIds.has(g.id) ? 'ftg-game-enter' : undefined}>
                      <GameCard game={g} />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {soon.length > 0 && (
              <section className="mt-6">
                <h2 className="display mb-2 text-2xl font-bold">Starting soon</h2>
                <div className="grid gap-2">
                  {soon.map((g) => (
                    <div key={g.id} className={pulseIds.has(g.id) ? 'ftg-game-enter' : undefined}>
                      <GameCard game={g} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
