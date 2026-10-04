import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { formatDistance } from '../../lib/format'
import { useLocation } from '../../lib/location'
import type { CourtDetail, Game, PublicUser } from '../../lib/types'
import { CourtAddPhotos } from '../../components/CourtAddPhotos'
import { CourtPhotoStrip } from '../../components/CourtPhotoStrip'
import { CourtPlacementMap } from '../../components/CourtPlacementMap'
import { GameCard } from '../../components/GameCard'
import { playerDisplayLabel } from '../../lib/format'
import { DistanceText, Lightbulb, SportName } from '../../components/icons'
import { Button, Card, ErrorText, Spinner } from '../../components/ui'

type AdminCourtDetail = CourtDetail & { creator: PublicUser | null; open_reports: number; games: Game[] }

export function AdminCourtReview() {
  const { courtId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { coords } = useLocation()
  const loc = coords ? `lat=${coords.latitude}&lng=${coords.longitude}` : ''

  const { data: court, isLoading, error } = useQuery({
    queryKey: ['admin', 'court', courtId, loc],
    queryFn: () => api<AdminCourtDetail>(`/api/admin/courts/${courtId}?${loc}`),
    enabled: !!courtId,
  })

  const review = useMutation({
    mutationFn: (body: { approve?: boolean; pending?: boolean; reason?: string }) =>
      api(`/api/admin/courts/${courtId}/review`, { method: 'POST', json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['court', courtId] })
      navigate('/admin/courts')
    },
    onError: (e) => alert(errorMessage(e)),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    )
  }

  if (error || !court) {
    return (
      <div className="grid gap-3 p-4">
        <ErrorText>{error ? errorMessage(error) : 'Court not found.'}</ErrorText>
        <Link to="/admin/courts" className="font-semibold text-brand">Back to courts</Link>
      </div>
    )
  }

  const statusClass =
    court.status === 'approved'
      ? 'bg-live/15 text-live'
      : court.status === 'pending'
        ? 'bg-players/25 text-ink'
        : 'bg-danger/15 text-danger'

  return (
    <div className="mx-auto grid max-w-2xl gap-4 pb-10">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" className="min-h-9 px-2" onClick={() => navigate('/admin/courts')}>
          ← Courts
        </Button>
        <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${statusClass}`}>{court.status}</span>
        {court.open_reports > 0 && (
          <Link to="/admin/reports" className="text-xs font-semibold text-danger">⚑ {court.open_reports} open reports</Link>
        )}
      </div>

      <h1 className="display text-4xl font-extrabold">{court.name}</h1>
      {court.creator && (
        <p className="text-sm text-ink-2">
          Proposed by{' '}
          <span className="font-semibold text-ink">{playerDisplayLabel(court.creator, true)}</span>
          {' · '}
          {new Date(court.created_at).toLocaleString()}
        </p>
      )}
      {court.rejection_reason && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Rejection reason: {court.rejection_reason}</p>
      )}

      <CourtPhotoStrip photos={court.photos} />
      {courtId && (
        <CourtAddPhotos courtId={courtId} photos={court.photos.filter((p) => p.trim())} canManage />
      )}

      <Card className="overflow-hidden p-0">
        <div className="h-52">
          <CourtPlacementMap
            value={{ latitude: court.latitude, longitude: court.longitude }}
            initial={{ latitude: court.latitude, longitude: court.longitude }}
            onChange={() => {}}
            me={coords}
            courts={[]}
            className="size-full"
            edgePinHint={false}
            readOnly
          />
        </div>
        <div className="border-t border-line p-3 text-sm">
          <p>{court.address ?? `${court.latitude.toFixed(5)}, ${court.longitude.toFixed(5)}`}</p>
          {court.distance_m != null && (
            <p className="mt-1 text-ink-2">
              <DistanceText>{formatDistance(court.distance_m)}</DistanceText> from your location
            </p>
          )}
          <Link to={`/?court=${court.id}`} className="mt-2 inline-block font-semibold text-brand">
            Open on public map
          </Link>
        </div>
      </Card>

      <Card>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-semibold text-ink-2">Sports</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {court.sports.map((s) => <SportName key={s.id} sport={s} />)}
            </dd>
          </div>
          {court.description && (
            <div>
              <dt className="font-semibold text-ink-2">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap">{court.description}</dd>
            </div>
          )}
          {court.opening_hours && (
            <div>
              <dt className="font-semibold text-ink-2">Hours</dt>
              <dd>{court.opening_hours}</dd>
            </div>
          )}
          {court.surface && (
            <div>
              <dt className="font-semibold text-ink-2">Surface</dt>
              <dd>{court.surface}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-ink-2">Lighting</dt>
            <dd className="inline-flex items-center gap-1">
              {court.lighting ? (
                <>
                  <Lightbulb className="size-4" aria-hidden /> Lit at night
                </>
              ) : (
                'Unknown / no'
              )}
            </dd>
          </div>
        </dl>
      </Card>

      {court.games.length > 0 && (
        <section>
          <h2 className="display mb-2 text-2xl font-bold">Scheduled games</h2>
          <div className="grid gap-2">
            {court.games.map((g) => (
              <GameCard key={g.id} game={g} showCourt={false} showHost viewerIsAdmin />
            ))}
          </div>
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t border-line bg-bg/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        {court.status === 'pending' && (
          <>
            <Button
              variant="live"
              className="min-h-11 flex-1"
              loading={review.isPending}
              onClick={() => review.mutate({ approve: true })}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              className="min-h-11 flex-1"
              loading={review.isPending}
              onClick={() => {
                const reason = prompt('Reason for rejecting (optional)') ?? undefined
                review.mutate({ approve: false, reason })
              }}
            >
              Reject
            </Button>
          </>
        )}
        {court.status === 'approved' && (
          <Button
            variant="secondary"
            className="min-h-11 flex-1"
            loading={review.isPending}
            onClick={() => {
              if (confirm('Move this court back to pending review? It will be hidden from the public map until approved.')) {
                review.mutate({ pending: true })
              }
            }}
          >
            Unapprove — send for review
          </Button>
        )}
        {court.status === 'rejected' && (
          <>
            <Button
              variant="live"
              className="min-h-11 flex-1"
              loading={review.isPending}
              onClick={() => review.mutate({ approve: true })}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 flex-1"
              loading={review.isPending}
              onClick={() => review.mutate({ pending: true })}
            >
              Back to pending
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          onClick={() => navigate(`/admin/courts?edit=${court.id}`)}
        >
          Edit fields
        </Button>
      </div>
    </div>
  )
}
