import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Game } from '../lib/types'
import { subscribeLiveGamePulse } from '../lib/liveGames'
import { gameIsUpcomingLater, sortPlayable } from '../lib/sort'
import { GameCard } from './GameCard'
import { MapBottomSheet } from './MapBottomSheet'
import { BaseSportIcon } from './icons'
import { ChevronRight, Plus } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { useListIntro } from '../lib/motion'

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
      className={`ftg-skeleton h-[4.5rem] shrink-0 rounded-xl border border-line ${className}`}
      aria-hidden
    />
  )
}

export function MapGamesRail({ games, isLoading, sport, viewerIsAdmin = false }: Props) {
  const { t } = useLocale()
  const [pulseIds, setPulseIds] = useState<Set<string>>(() => new Set())
  useEffect(() => subscribeLiveGamePulse(setPulseIds), [])

  const sorted = sortPlayable(games ?? []).slice(0, 12)
  const showSkeletons = isLoading && sorted.length === 0
  const intro = useListIntro(sorted.length, sport)
  const createHref = sport ? `/games/new?sport=${sport}` : '/games/new'
  const listHref = sport ? `/play?sport=${sport}` : '/play'

  return (
    <MapBottomSheet ariaLabel={t.courts.rail.title} layout="dock">
      <div className="flex items-end justify-between gap-2 px-3 pb-1 pt-0.5 md:px-4 md:pb-2 md:pt-1">
        <div>
          <h2 className="display text-sm font-bold md:text-base">{t.courts.rail.title}</h2>
          <p className="text-[11px] text-ink-2 md:text-xs">
            {showSkeletons ? t.courts.rail.loading : sorted.length === 0 ? t.courts.rail.noOpen : t.courts.rail.open.replace('{n}', String(sorted.length))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-0.5">
          <Link
            to={createHref}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold md:px-3 md:py-1.5 md:text-sm"
          >
            <Plus className="size-4" aria-hidden />
            {t.courts.rail.create}
          </Link>
          {sorted.length > 0 && (
            <Link to={listHref} className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand">
              {t.courts.rail.seeAll}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-x-auto snap-x snap-mandatory px-2 pb-2 md:px-3 md:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showSkeletons ? (
          <div className="flex gap-3">
            <SkeletonCard className="w-[min(62vw,220px)] md:w-[min(72vw,280px)]" />
            <SkeletonCard className="w-[min(62vw,220px)] md:w-[min(72vw,280px)]" />
            <SkeletonCard className="hidden w-[min(62vw,220px)] sm:block md:w-[min(72vw,280px)]" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="mx-1 rounded-xl border border-line bg-surface-2 p-3 md:rounded-2xl md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <BaseSportIcon className="size-8 shrink-0 text-brand md:size-10" />
              <div className="min-w-0">
                <p className="text-sm font-semibold md:text-base">{t.courts.rail.emptyTitle}</p>
                <p className="text-xs text-ink-2 md:text-sm">{t.courts.rail.emptyBody}</p>
              </div>
            </div>
            <Link
              to={createHref}
              className="display mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white md:mt-3 md:min-h-11 md:text-base"
            >
              <Plus className="size-5" aria-hidden />
              {t.courts.rail.createGame}
            </Link>
          </div>
        ) : (
          <div className={`flex gap-2 md:gap-3 ${intro}`}>
            {sorted.map((g) => (
              <div
                key={g.id}
                className={`shrink-0 snap-center ${pulseIds.has(g.id) ? 'ftg-game-enter' : ''}`}
              >
                <GameCard
                  game={g}
                  variant="map"
                  showCourt
                  viewerIsAdmin={viewerIsAdmin}
                  scheduleAccent={gameIsUpcomingLater(g) ? 'upcoming' : undefined}
                  className="w-[min(62vw,220px)] md:w-[min(72vw,280px)]"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </MapBottomSheet>
  )
}
