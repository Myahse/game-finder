import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { syncNotifyArea, type NotifyAreaState } from '../lib/notifyArea'
import { formatDistance, timeAgo } from '../lib/format'
import { useLocation, type Coords } from '../lib/location'
import { MAP_NEARBY_RADIUS_KM } from '../lib/nearby'
import { useBrowseSportSlug, useMySport } from '../lib/mySport'
import { useCourt, useCourtsNearby, useGamesNearby, useSports } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { useQueryErrorToast } from '../lib/toastErrors'
import { MapBottomSheet } from '../components/MapBottomSheet'
import { MapGamesRail } from '../components/MapGamesRail'
import type { Court } from '../lib/types'
import { CourtMap } from '../components/CourtMap'
import { CourtActions } from '../components/CourtActions'
import { CourtPhotoStrip } from '../components/CourtPhotoStrip'
import { GameCard } from '../components/GameCard'
import { DistanceText, LiveText, SportName } from '../components/icons'
import { Chip, Spinner, StatusPill } from '../components/ui'
import { Plus } from 'lucide-react'

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const sport = useBrowseSportSlug()
  const mySport = useMySport()
  const isAdmin = user?.role === 'admin'
  const selectedId = params.get('court')
  const { coords, status, center } = useLocation()
  const { data: sports } = useSports()
  const courtsQ = useCourtsNearby(center, sport)
  const gamesQ = useGamesNearby(center, sport, MAP_NEARBY_RADIUS_KM)
  const courts = courtsQ.data
  const nearbyGames = gamesQ.data
  const gamesLoading = gamesQ.isLoading
  useQueryErrorToast(courtsQ.error)
  useQueryErrorToast(gamesQ.error)

  // Keep alert/browse zone aligned when traveling (rate-limited server-side).
  const notifyState = useRef<NotifyAreaState>({ lastSent: null, lastAttemptMs: 0 })
  useEffect(() => {
    if (!coords) return
    syncNotifyArea(coords, notifyState.current)
      .then((s) => {
        notifyState.current = s
      })
      .catch(() => {})
  }, [coords])

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const liveCount = courts?.filter((c) => c.activity === 'active').length ?? 0

  return (
    <div className="relative h-full min-h-[480px] overflow-hidden">
      <CourtMap
        courts={courts ?? []}
        center={center}
        me={coords}
        sportSlug={sport}
        selectedId={selectedId}
        onSelect={(c: Court) => update('court', c.id)}
      />

      {/* Filters */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-bg/95 to-transparent px-4 pb-6 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="display text-3xl font-extrabold md:hidden">
            Find the <span className="text-brand">Game</span>
          </p>
          <span className="display inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-live px-3 py-1 text-base font-bold text-white shadow">
            <LiveText>{liveCount} live</LiveText>
          </span>
        </div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {isAdmin ? (
            <>
              <Chip active={!sport} onClick={() => update('sport', null)}>
                All
              </Chip>
              {sports
                ?.filter((s) => s.active)
                .map((s) => (
                  <Chip key={s.id} active={sport === s.slug} onClick={() => update('sport', s.slug)}>
                    <SportName sport={s} iconClassName="size-4" />
                  </Chip>
                ))}
            </>
          ) : (
            mySport && (
              <Chip active>
                <SportName sport={mySport} iconClassName="size-4" />
              </Chip>
            )
          )}
          <Link to="/courts/new">
            <Chip>
              <span className="inline-flex items-center gap-1">
                <Plus className="size-4" aria-hidden /> Add court
              </span>
            </Chip>
          </Link>
        </div>
        {status === 'denied' && (
          <p className="mt-2 rounded-lg bg-surface/95 px-3 py-2 text-xs text-ink-2 shadow">
            Location is off — showing Grand-Bassam. Allow location to see games near you.
          </p>
        )}
      </div>

      {!selectedId && <MapGamesRail games={nearbyGames} isLoading={gamesLoading} sport={sport} />}

      {selectedId && <CourtSheet id={selectedId} coords={coords} onClose={() => update('court', null)} />}
    </div>
  )
}

function CourtSheet({ id, coords, onClose }: { id: string; coords: Coords | null; onClose: () => void }) {
  const { data: court, isLoading, error } = useCourt(id, coords)
  const games = court?.games ?? []
  const live = games.filter((g) => g.status === 'active')

  return (
    <MapBottomSheet ariaLabel={court?.name ?? 'Court'} layout="panel" className="z-20 md:left-auto">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-surface-2 p-2 text-ink-2 hover:text-ink md:top-4"
        aria-label="Close"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>

      {isLoading && (
        <div className="flex justify-center p-10">
          <Spinner className="text-brand" />
        </div>
      )}
      {error && <p className="p-6 text-ink-2">This court isn't available.</p>}

      {court && (
        <div className="relative p-5 pt-3 md:pt-5">
          <CourtPhotoStrip photos={court.photos} compact />
          <h2 className="display pr-10 text-4xl font-extrabold">{court.name}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
            <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
              {court.sports.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-ink-2/50">·</span>}
                  <SportName sport={s} />
                </span>
              ))}
            </span>
            {court.distance_m != null && <DistanceText>{formatDistance(court.distance_m)} away</DistanceText>}
          </p>

          <div className="mt-4 rounded-2xl bg-surface-2 p-4">
            <StatusPill activity={court.activity} />
            <p className="display mt-2 text-3xl font-bold">
              {court.player_count > 0 ? (
                <>
                  {court.player_count} player{court.player_count === 1 ? '' : 's'}{' '}
                  {court.activity === 'active' ? 'playing now' : 'here now'}
                </>
              ) : (
                'Nobody here yet'
              )}
            </p>
            <p className="text-sm text-ink-2">Last activity: {timeAgo(court.last_activity_at)}</p>
          </div>

          <div className="mt-4">
            <CourtActions court={court} games={games} me={coords} />
          </div>

          {games.length > 0 && (
            <div className="mt-6">
              <h3 className="display mb-2 text-2xl font-bold">{live.length ? 'Games now' : 'Upcoming games'}</h3>
              <div className="grid gap-2">
                {games.slice(0, 4).map((g) => (
                  <GameCard key={g.id} game={g} showCourt={false} />
                ))}
              </div>
            </div>
          )}

          <Link to={`/courts/${court.id}`} className="mt-5 block text-center text-sm font-semibold text-brand">
            Court details, photos & hours →
          </Link>
        </div>
      )}
    </MapBottomSheet>
  )
}
