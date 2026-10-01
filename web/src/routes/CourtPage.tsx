import { useParams } from 'react-router-dom'
import { formatDistance, timeAgo } from '../lib/format'
import { useLocation } from '../lib/location'
import { useCourt } from '../lib/queries'
import { CourtActions } from '../components/CourtActions'
import { GameCard } from '../components/GameCard'
import { Card, Empty, PageHeader, Spinner, StatusPill } from '../components/ui'

export function CourtPage() {
  const { id } = useParams()
  const { coords } = useLocation()
  const { data: court, isLoading } = useCourt(id, coords)

  if (isLoading) return <Loading />
  if (!court) return <Empty icon="🤷" title="Court not found" />

  return (
    <div className="pb-10">
      <PageHeader title={court.name} back={`/?court=${court.id}`} />
      {court.photos.length > 0 ? (
        <div className="flex snap-x gap-2 overflow-x-auto px-4 pt-4">
          {court.photos.map((src) => (
            <img key={src} src={src} alt="" className="h-48 w-72 shrink-0 snap-start rounded-2xl object-cover" loading="lazy" />
          ))}
        </div>
      ) : null}

      <div className="mx-auto grid max-w-2xl gap-4 p-4">
        {court.status !== 'approved' && (
          <p className="rounded-xl bg-players/20 p-3 text-sm font-medium">
            {court.status === 'pending' ? '⏳ Waiting for review. Only you can see this court.' : `❌ Rejected${court.rejection_reason ? `: ${court.rejection_reason}` : ''}`}
          </p>
        )}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill activity={court.activity} />
            {court.distance_m != null && <span className="display text-2xl font-bold">📍 {formatDistance(court.distance_m)}</span>}
          </div>
          <p className="display mt-3 text-4xl font-extrabold">
            {court.player_count} <span className="text-2xl text-ink-2">players now</span>
          </p>
          <p className="text-sm text-ink-2">Last activity: {timeAgo(court.last_activity_at)}</p>
          {court.status === 'approved' && (
            <div className="mt-4">
              <CourtActions court={court} games={court.games} me={coords} />
            </div>
          )}
        </Card>

        <section>
          <h2 className="display mb-2 text-2xl font-bold">Games</h2>
          {court.games.length ? (
            <div className="grid gap-2">
              {court.games.map((g) => (
                <GameCard key={g.id} game={g} showCourt={false} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2">No games yet. Create one and players nearby will see it.</p>
          )}
        </section>

        <Card>
          <h2 className="display mb-3 text-2xl font-bold">Court info</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <Info label="Sports" value={court.sports.map((s) => `${s.icon} ${s.name}`).join(', ')} />
            <Info label="Address" value={court.address} />
            <Info label="Opening hours" value={court.opening_hours} />
            <Info label="Surface" value={court.surface} />
            <Info label="Lighting" value={court.lighting == null ? null : court.lighting ? '💡 Lit at night' : 'No lights'} />
          </dl>
          {court.description && <p className="mt-3 text-sm text-ink-2">{court.description}</p>}
        </Card>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="font-semibold text-ink-2">{label}</dt>
      <dd>{value || '—'}</dd>
    </>
  )
}

export function Loading() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <Spinner className="text-brand" />
    </div>
  )
}
