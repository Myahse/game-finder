import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game } from '../lib/types'
import { subscribeLiveGamePulse } from '../lib/liveGames'
import { sortPlayable } from '../lib/sort'
import { GameCard } from './GameCard'
import { MapBottomSheet } from './MapBottomSheet'
import { BaseSportIcon } from './icons'
import { ChevronRight, Plus } from 'lucide-react'

type Props = {
  games: Game[] | undefined
  isLoading: boolean
  sport: string | null
  viewerIsAdmin?: boolean
}

/** Nearby games — Maresi-style docked modal with horizontal property cards. */
function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-[7.5rem] shrink-0 animate-pulse rounded-2xl border border-line bg-surface-2/80 ${className}`}
      aria-hidden
    />
  )
}

export function MapGamesRail({ games, isLoading, sport, viewerIsAdmin = false }: Props) {
  const [pulseIds, setPulseIds] = useState<Set<string>>(() => new Set())
  useEffect(() => subscribeLiveGamePulse(setPulseIds), [])

  const sorted = sortPlayable(games ?? []).slice(0, 12)
  const showSkeletons = isLoading && sorted.length === 0
  const createHref = sport ? `/games/new?sport=${sport}` : '/games/new'
  const listHref = sport ? `/play?sport=${sport}` : '/play'

  return (
    <MapBottomSheet ariaLabel="Games nearby" layout="dock">
      <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-1">
        <div>
          <h2 className="display text-base font-bold">Games nearby</h2>
          <p className="text-xs text-ink-2">
            {showSkeletons ? 'Loading…' : sorted.length === 0 ? 'No open games' : `${sorted.length} open`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          <Link
            to={createHref}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold"
          >
            <Plus className="size-4" aria-hidden />
            Create
          </Link>
          {sorted.length > 0 && (
            <Link to={listHref} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand">
              See all
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto snap-x snap-mandatory px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showSkeletons ? (
          <div className="flex gap-3">
            <SkeletonCard className="w-[min(72vw,280px)]" />
            <SkeletonCard className="w-[min(72vw,280px)]" />
            <SkeletonCard className="hidden w-[min(72vw,280px)] sm:block" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="mx-1 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-3">
              <BaseSportIcon className="size-10 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="font-semibold">No open games yet</p>
                <p className="text-sm text-ink-2">Add a court photo when you create a game.</p>
              </div>
            </div>
            <Link
              to={createHref}
              className="display mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-extrabold text-white"
            >
              <Plus className="size-5" aria-hidden />
              Create game
            </Link>
          </div>
        ) : (
          <div className="flex gap-3">
            {sorted.map((g) => (
              <div
                key={g.id}
                className={`shrink-0 snap-center ${pulseIds.has(g.id) ? 'ftg-game-enter' : ''}`}
              >
                <GameCard game={g} variant="map" viewerIsAdmin={viewerIsAdmin} className="w-[min(72vw,280px)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </MapBottomSheet>
  )
}
