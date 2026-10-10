import { Link } from 'react-router-dom'
import { useLocation } from '../lib/location'
import { useMyGames, useMyPresence } from '../lib/queries'
import { GameCardSkeletons, PlayGameCard } from '../components/PlayGameCard'
import { SleepyEmpty } from '../components/SleepyBall'
import { Circle } from '../components/icons'
import { Card, PageHeader } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { useListIntro } from '../lib/motion'
import { useLoadMorph } from '../lib/playMotion'

export function MyGamesPage() {
  const { t, locale } = useLocale()
  const tm = t.games.my
  const { coords } = useLocation()
  const { data, isLoading } = useMyGames(coords)
  const { data: presence } = useMyPresence()
  const intro = useListIntro((data?.current.length ?? 0) + (data?.past.length ?? 0))
  // Right after loading, the skeleton rows melt into the real cards (instead of the list intro).
  const morph = useLoadMorph(isLoading)
  const listIntro = morph ? '' : intro

  return (
    <div className="pb-10">
      <PageHeader title={tm.title} />
      <div className="mx-auto grid max-w-2xl gap-6 p-4">
        {presence && (
          <Link to={`/courts/${presence.court_id}`} className="ftg-lift block rounded-2xl">
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
          <GameCardSkeletons rows={3} label={t.account.ui.loading} />
        ) : (
          <>
            <section>
              <h2 className="display mb-2 text-2xl font-bold">{tm.upcoming}</h2>
              {data?.current.length ? (
                <div className={`grid gap-2 ${listIntro}`}>
                  {data.current.map((g, i) => (
                    <PlayGameCard key={g.id} game={g} morphIndex={morph ? i : undefined} />
                  ))}
                </div>
              ) : (
                <SleepyEmpty title={tm.empty} linkTo="/play" linkText={tm.findGame} wakeLabel={tm.wakeBall} />
              )}
            </section>
            {!!data?.past.length && (
              <section>
                <h2 className="display mb-2 text-2xl font-bold text-ink-2">{tm.past}</h2>
                <div className={`grid gap-2 opacity-80 ${listIntro}`}>
                  {data.past.map((g, i) => (
                    <PlayGameCard key={g.id} game={g} morphIndex={morph ? data.current.length + i : undefined} />
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
