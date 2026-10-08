import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { subscribeLiveGamePulse } from '../lib/liveGames'
import { useLocation } from '../lib/location'
import { useBrowseSportSlug, useMySports } from '../lib/mySport'
import { usePlayGamesNearby, useSports } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { useQueryErrorToast } from '../lib/toastErrors'
import { sortPlayable, splitScheduledBySoon } from '../lib/sort'
import { GameCard } from '../components/GameCard'
import { MapPin } from 'lucide-react'
import { BaseSportIcon, LiveText, SportName } from '../components/icons'
import { ScreenGuide } from '../components/ScreenGuide'
import { Chip, Empty, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'
import { useLocale } from '../i18n/LocaleProvider'

/** Live games nearby, closest → liveliest → most room. */
export function PlayPage() {
  const [pulseIds, setPulseIds] = useState<Set<string>>(() => new Set())
  useEffect(() => subscribeLiveGamePulse(setPulseIds), [])

  const [, setParams] = useSearchParams()
  const { t } = useLocale()
  const { user } = useAuth()
  const sport = useBrowseSportSlug()
  const mySports = useMySports()
  const isAdmin = user?.role === 'admin'
  const sportSlugs = useMemo(() => {
    if (isAdmin) return sport ? [sport] : [null as string | null]
    return mySports.map((s) => s.slug)
  }, [isAdmin, sport, mySports])

  const { center, status, waitingGps, hasFix } = useLocation()
  const { data: sports } = useSports()
  const { data: games, isLoading, isError, error } = usePlayGamesNearby(center, sportSlugs)
  useQueryErrorToast(error)

  const sorted = sortPlayable(games ?? [])
  const live = sorted.filter((g) => g.status === 'active')
  const { soon, upcoming } = splitScheduledBySoon(sorted)

  return (
    <div className="pb-10">
      <PageHeader title={t.courts.play.title} back="/" />
      <div className="mx-auto max-w-2xl p-4">
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {isAdmin ? (
            <>
              <Chip active={!sport} onClick={() => setParams({}, { replace: true })}>
                {t.courts.play.all}
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
            mySports.map((s) => (
              <Chip key={s.id} active>
                <SportName sport={s} />
              </Chip>
            ))
          )}
        </div>
        {waitingGps && (
          <p className="mb-3 text-sm text-ink-2">
            {t.courts.play.findingLocation}
          </p>
        )}
        {!hasFix && status === 'denied' && (
          <p className="mb-3 text-sm text-ink-2">{t.courts.play.fromDefault}</p>
        )}

        {isError && (
          <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error instanceof Error ? error.message : t.courts.play.loadFailed}
          </p>
        )}

        {isLoading ? (
          <Loading />
        ) : sorted.length === 0 ? (
          <Empty icon={<BaseSportIcon className="size-14" />} title={t.courts.play.emptyTitle}>
            {t.courts.play.emptyBody}{' '}
            <Link to={sport ? `/games/new?sport=${sport}` : '/games/new'} className="font-semibold text-brand">
              {t.courts.play.createGame}
            </Link>
          </Empty>
        ) : (
          <>
            {live.length > 0 && (
              <section>
                <h2 className="display mb-2 inline-flex items-center gap-2 text-2xl font-bold">
                  <LiveText>{t.courts.play.playingNow}</LiveText>
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
              <section className={live.length > 0 ? 'mt-6' : undefined}>
                <h2 className="display mb-2 text-2xl font-bold">{t.courts.play.startingSoon}</h2>
                <div className="grid gap-2">
                  {soon.map((g) => (
                    <div key={g.id} className={pulseIds.has(g.id) ? 'ftg-game-enter' : undefined}>
                      <GameCard game={g} />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section className={live.length > 0 || soon.length > 0 ? 'mt-6' : undefined}>
                <h2 className="display mb-2 text-2xl font-bold text-upcoming">{t.courts.play.upcoming}</h2>
                <p className="mb-2 text-sm text-ink-2">{t.courts.play.upcomingHint}</p>
                <div className="grid gap-2">
                  {upcoming.map((g) => (
                    <div key={g.id} className={pulseIds.has(g.id) ? 'ftg-game-enter' : undefined}>
                      <GameCard game={g} scheduleAccent="upcoming" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <ScreenGuide screen="play" tips={[{ icon: MapPin, title: t.guide.playTitle, body: t.guide.playBody }]} />
    </div>
  )
}
