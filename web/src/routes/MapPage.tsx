import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { syncNotifyArea, type NotifyAreaState } from '../lib/notifyArea'
import { formatDistance, timeAgo } from '../lib/format'
import { useLocation, type Coords } from '../lib/location'
import { MAP_NEARBY_RADIUS_KM, PLAY_UPCOMING_HOURS } from '../lib/nearby'
import { gameIsUpcomingLater } from '../lib/sort'
import { useBrowseSportSlug, useMySports } from '../lib/mySport'
import { useCourt, useCourtsNearby, useGamesNearby, useSports } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { useQueryErrorToast } from '../lib/toastErrors'
import { MapBottomSheet } from '../components/MapBottomSheet'
import { MapGamesRail } from '../components/MapGamesRail'
import type { Court } from '../lib/types'
import { CourtMap } from '../components/CourtMap'
import { MapSearchBar } from '../components/MapSearchBar'
import type { MapRef } from 'react-map-gl/mapbox'
import { CourtActions } from '../components/CourtActions'
import { ShareCourtButton } from '../components/ShareCourtButton'
import { CourtPhotoStrip } from '../components/CourtPhotoStrip'
import { CountSentence, LiveCount, OpenNowPill } from '../components/CourtLiveBits'
import { GameCard } from '../components/GameCard'
import { ALL_SPORT_ICONS, DistanceText, LiveText, SportName } from '../components/icons'
import { ScreenGuide } from '../components/ScreenGuide'
import { Chip, Spinner, StatusPill } from '../components/ui'
import { ArrowLeftRight, Plus, Users } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const { t } = useLocale()
  const { user } = useAuth()
  const sport = useBrowseSportSlug()
  const mySports = useMySports()
  const mapRef = useRef<MapRef>(null)
  const isAdmin = user?.role === 'admin'
  const selectedId = params.get('court')
  const { coords, status, center: gpsCenter } = useLocation()
  const [browseCenter, setBrowseCenter] = useState<Coords | null>(null)
  const queryCenter = browseCenter ?? gpsCenter
  const { data: sports } = useSports()
  const courtsQ = useCourtsNearby(queryCenter, sport)
  const gamesQ = useGamesNearby(queryCenter, sport, MAP_NEARBY_RADIUS_KM, PLAY_UPCOMING_HOURS)
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
        mapRef={mapRef}
        courts={courts ?? []}
        nearbyGames={nearbyGames ?? []}
        center={gpsCenter}
        me={coords}
        sportSlug={sport}
        selectedId={selectedId}
        onBrowseCenterChange={setBrowseCenter}
        onSelect={(c: Court) => update('court', c.id)}
      />

      {/* Filters */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-bg/95 to-transparent px-4 pb-6 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="display min-w-0 truncate text-[clamp(1.25rem,6.5vw,1.875rem)] font-extrabold md:hidden">
            {t.courts.map.titleStart} <span className="text-brand">{t.courts.map.titleEnd}</span>
          </p>
          <span className="display inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-live px-3 py-1 text-sm font-bold text-white shadow min-[400px]:text-base">
            <LiveText>{t.courts.map.live.replace('{n}', String(liveCount))}</LiveText>
          </span>
        </div>
        <MapSearchBar
          className="mt-2"
          mapRef={mapRef}
          proximity={queryCenter}
          locationBias={coords}
          courts={courts ?? []}
          onSelectCourt={(c) => update('court', c.id)}
          typingPlaceholder
        />
        <div data-guide="sport-chips" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {isAdmin ? (
            <>
              <Chip active={!sport} onClick={() => update('sport', null)}>
                {t.courts.map.all}
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
            mySports.map((s) => (
              <Chip key={s.id} active={sport === s.slug} onClick={() => update('sport', s.slug)}>
                <SportName sport={s} iconClassName="size-4" />
              </Chip>
            ))
          )}
          <Link to="/courts/new">
            <Chip>
              <span className="inline-flex items-center gap-1">
                <Plus className="size-4" aria-hidden /> {t.courts.map.addCourt}
              </span>
            </Chip>
          </Link>
        </div>
        {isAdmin && (
          <p className="mt-2 rounded-lg bg-surface/95 px-3 py-2 text-xs text-ink-2 shadow">
            {t.courts.map.adminNote}
          </p>
        )}
        {status === 'denied' && (
          <p className="mt-2 rounded-lg bg-surface/95 px-3 py-2 text-xs text-ink-2 shadow">
            {t.courts.map.locationOff}
          </p>
        )}
      </div>

      {!selectedId && (
        <MapGamesRail games={nearbyGames} isLoading={gamesLoading} sport={sport} viewerIsAdmin={isAdmin} />
      )}

      {selectedId && (
        <CourtSheet id={selectedId} coords={coords} viewerIsAdmin={isAdmin} onClose={() => update('court', null)} />
      )}

      <ScreenGuide
        screen="map"
        tips={[
          { icon: ALL_SPORT_ICONS, title: t.guide.sportsTitle, body: t.guide.sportsBody },
          { target: 'sport-chips', icon: ArrowLeftRight, title: t.guide.chipsTitle, body: t.guide.chipsBody },
          { target: 'nav-play', icon: Users, title: t.guide.playTabTitle, body: t.guide.playTabBody },
        ]}
      />
    </div>
  )
}

function CourtSheet({
  id,
  coords,
  viewerIsAdmin,
  onClose,
}: {
  id: string
  coords: Coords | null
  viewerIsAdmin: boolean
  onClose: () => void
}) {
  const { t } = useLocale()
  const { data: court, isLoading, error } = useCourt(id, coords)
  const games = court?.games ?? []
  const live = games.filter((g) => g.status === 'active')

  return (
    <MapBottomSheet ariaLabel={court?.name ?? t.courts.court} layout="panel" className="z-20 md:left-auto">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-surface-2 p-2 text-ink-2 hover:text-ink md:top-4"
        aria-label={t.courts.map.close}
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
      {error && <p className="p-6 text-ink-2">{t.courts.map.unavailable}</p>}

      {court && (
        <div className="relative p-5 pt-3 md:pt-5">
          <CourtPhotoStrip photos={court.photos} compact />
          <div className="flex items-start justify-between gap-2 pr-10">
            <h2 className="display text-4xl font-extrabold">{court.name}</h2>
            {court.status === 'approved' && (
              <ShareCourtButton
                courtId={court.id}
                courtName={court.name}
                variant="ghost"
                className="min-h-9 shrink-0 px-2"
              />
            )}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
            <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
              {court.sports.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-ink-2/50">·</span>}
                  <SportName sport={s} />
                </span>
              ))}
            </span>
            {court.distance_m != null && <DistanceText>{t.courts.map.away.replace('{distance}', formatDistance(court.distance_m))}</DistanceText>}
          </p>

          <div className="mt-4 rounded-2xl bg-surface-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill activity={court.activity} />
              <OpenNowPill hours={court.opening_hours} />
            </div>
            <p className="display mt-2 text-3xl font-bold">
              {court.player_count > 0 ? (
                <CountSentence
                  template={
                    court.activity === 'active'
                      ? court.player_count === 1 ? t.courts.map.playersPlayingNowOne : t.courts.map.playersPlayingNowMany
                      : court.player_count === 1 ? t.courts.map.playersHereNowOne : t.courts.map.playersHereNowMany
                  }
                  n={<LiveCount value={court.player_count} live />}
                />
              ) : (
                t.courts.map.nobodyHere
              )}
            </p>
            <p className="text-sm text-ink-2">{t.courts.lastActivity.replace('{time}', timeAgo(court.last_activity_at))}</p>
          </div>

          <div className="mt-4">
            <CourtActions court={court} games={games} me={coords} />
          </div>

          {games.length > 0 && (
            <div className="mt-6">
              <h3 className="display mb-2 text-2xl font-bold">{live.length ? t.courts.map.gamesNow : t.courts.map.upcomingGames}</h3>
              <div className="grid gap-2">
                {games.slice(0, 4).map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    showCourt={false}
                    showHost
                    viewerIsAdmin={viewerIsAdmin}
                    scheduleAccent={gameIsUpcomingLater(g) ? 'upcoming' : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          <Link to={`/courts/${court.id}`} className="mt-5 block text-center text-sm font-semibold text-brand">
            {t.courts.map.detailsLink}
          </Link>
        </div>
      )}
    </MapBottomSheet>
  )
}
