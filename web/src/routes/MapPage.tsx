import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDistance, timeAgo } from '../lib/format'
import { useLocation, type Coords } from '../lib/location'
import { useCourt, useCourtsNearby, useSports } from '../lib/queries'
import type { Court } from '../lib/types'
import { CourtMap } from '../components/CourtMap'
import { CourtActions } from '../components/CourtActions'
import { GameCard } from '../components/GameCard'
import { Chip, Spinner, StatusPill } from '../components/ui'

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const sport = params.get('sport')
  const selectedId = params.get('court')
  const { coords, status, center } = useLocation()
  const { data: sports } = useSports()
  const { data: courts, isLoading } = useCourtsNearby(center, sport)

  // Share a coarse (~1 km) area once so we can alert about games nearby.
  const sentArea = useRef(false)
  useEffect(() => {
    if (coords && !sentArea.current) {
      sentArea.current = true
      api('/api/me/notify-area', { method: 'POST', json: coords }).catch(() => {})
    }
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
          <span className="display shrink-0 whitespace-nowrap rounded-full bg-live px-3 py-1 text-base font-bold text-white shadow">
            🔥 {liveCount} live
          </span>
        </div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={!sport} onClick={() => update('sport', null)}>
            All
          </Chip>
          {sports
            ?.filter((s) => s.active)
            .map((s) => (
              <Chip key={s.id} active={sport === s.slug} onClick={() => update('sport', s.slug)}>
                <span aria-hidden>{s.icon}</span> {s.name}
              </Chip>
            ))}
          <Link to="/courts/new">
            <Chip>＋ Add court</Chip>
          </Link>
        </div>
        {status === 'denied' && (
          <p className="mt-2 rounded-lg bg-surface/95 px-3 py-2 text-xs text-ink-2 shadow">
            Location is off — showing Grand-Bassam. Allow location to see games near you.
          </p>
        )}
        {isLoading && (
          <div className="mt-2">
            <Spinner className="text-brand" />
          </div>
        )}
      </div>

      {/* I WANT TO PLAY */}
      {!selectedId && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
          <button
            type="button"
            onClick={() => navigate(sport ? `/play?sport=${sport}` : '/play')}
            className="display flex min-h-16 w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-brand text-3xl font-extrabold text-white shadow-2xl shadow-brand/30 transition active:scale-[0.98]"
          >
            <span aria-hidden>🏀</span> I want to play
          </button>
        </div>
      )}

      {selectedId && <CourtSheet id={selectedId} coords={coords} onClose={() => update('court', null)} />}
    </div>
  )
}

function CourtSheet({ id, coords, onClose }: { id: string; coords: Coords | null; onClose: () => void }) {
  const { data: court, isLoading, error } = useCourt(id, coords)
  const games = court?.games ?? []
  const live = games.filter((g) => g.status === 'active')

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 max-h-[78%] overflow-y-auto rounded-t-3xl border-t border-line bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.18)] md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[400px] md:rounded-3xl md:border"
      role="dialog"
      aria-label={court?.name ?? 'Court'}
    >
      <div className="sticky top-0 flex justify-center bg-surface pt-2 md:hidden">
        <span className="h-1.5 w-10 rounded-full bg-line" />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-surface-2 p-2 text-ink-2 hover:text-ink"
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
        <div className="p-5 pt-3">
          <h2 className="display pr-10 text-4xl font-extrabold">{court.name}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
            <span>{court.sports.map((s) => `${s.icon} ${s.name}`).join(' · ')}</span>
            {court.distance_m != null && <span>📍 {formatDistance(court.distance_m)} away</span>}
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
    </div>
  )
}
