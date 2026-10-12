import { Link } from 'react-router-dom'
import { ChevronRight, Globe, Users } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useLocation as useGeo } from '../../lib/location'
import { useCourtsNearby } from '../../lib/queries'
import { formatDistance } from '../../lib/format'
import { SkeletonList } from '../../components/ui'
import { SportIcon } from '../../components/icons'
import { hasJeuSport } from '../../jeu/words'
import { useLobby } from './JeuLayout'

/** Courts near the player with a Mode Jeu sport, each one an arena. */
export function JeuArenasPage() {
  const { t } = useLocale()
  const tj = t.jeu
  const { center } = useGeo()
  const { data, isLoading } = useCourtsNearby(center, null, 15)
  const lobby = useLobby()
  const courts = (data ?? []).filter(hasJeuSport).sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity))
  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 py-3">
      <h1 className="display text-3xl font-black uppercase">{tj.arenas.title}</h1>
      {isLoading && <SkeletonList rows={4} />}
      {!isLoading && courts.length === 0 && <p className="text-sm text-ink-2">{tj.map.noCourts}</p>}
      {courts.map((c) => {
        const rooms = lobby.rooms.filter((r) => r.court_id === c.id).length
        return (
          <Link key={c.id} to={`/jeu/arene/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <b className="display truncate text-lg font-extrabold uppercase leading-none">{c.name}</b>
              <span className="flex flex-wrap gap-1.5 text-ink-2">{c.sports.filter((x) => hasJeuSport({ sports: [x] })).map((x) => <SportIcon key={x.slug} slug={x.slug} className="size-4" />)}</span>
              <span className="flex flex-wrap gap-x-3 text-xs text-ink-2">
                {c.distance_m != null && <span>{formatDistance(c.distance_m)}</span>}
                <span className="inline-flex items-center gap-1 text-live"><Users className="size-3.5" aria-hidden />{tj.arenas.players.replace('{n}', String(c.player_count))}</span>
                {rooms > 0 && <span className="inline-flex items-center gap-1 text-[var(--gold)]"><Globe className="size-3.5" aria-hidden />{rooms > 1 ? tj.map.matches.replace('{n}', String(rooms)) : tj.map.match}</span>}
              </span>
            </div>
            <ChevronRight className="size-5 text-ink-2" aria-hidden />
          </Link>
        )
      })}
    </div>
  )
}
