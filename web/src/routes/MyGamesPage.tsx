import { Link } from 'react-router-dom'
import { useLocation } from '../lib/location'
import { useMyGames, useMyPresence } from '../lib/queries'
import { GameCard } from '../components/GameCard'
import { CalendarDays, Circle } from '../components/icons'
import { Card, Empty, PageHeader } from '../components/ui'
import { Loading } from './CourtPage'
import { useLocale } from '../i18n/LocaleProvider'

export function MyGamesPage() {
  const { t, locale } = useLocale()
  const tm = t.games.my
  const { coords } = useLocation()
  const { data, isLoading } = useMyGames(coords)
  const { data: presence } = useMyPresence()

  return (
    <div className="pb-10">
      <PageHeader title={tm.title} />
      <div className="mx-auto grid max-w-2xl gap-6 p-4">
        {presence && (
          <Link to={`/courts/${presence.court_id}`}>
            <Card className="border-live/40 bg-live/10">
              <p className="flex items-center gap-2 font-semibold text-live">
                <Circle className="size-3 fill-live text-live" aria-hidden />
                {tm.checkedIn.replace('{court}', presence.court.name)}
              </p>
              <p className="text-sm text-ink-2">
                {tm.until.replace('{time}', new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(presence.expires_at)))}
              </p>
            </Card>
          </Link>
        )}
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <section>
              <h2 className="display mb-2 text-2xl font-bold">{tm.upcoming}</h2>
              {data?.current.length ? (
                <div className="grid gap-2">
                  {data.current.map((g) => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              ) : (
                <Empty icon={<CalendarDays className="size-14" strokeWidth={1.5} />} title={tm.empty}>
                  <Link to="/play" className="font-semibold text-brand">
                    {tm.findGame}
                  </Link>
                </Empty>
              )}
            </section>
            {!!data?.past.length && (
              <section>
                <h2 className="display mb-2 text-2xl font-bold text-ink-2">{tm.past}</h2>
                <div className="grid gap-2 opacity-80">
                  {data.past.map((g) => (
                    <GameCard key={g.id} game={g} />
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
