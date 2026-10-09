import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { formatDistance, timeAgo } from '../lib/format'
import { CourtAddPhotos } from '../components/CourtAddPhotos'
import { CourtInfoEditor } from '../components/CourtInfoEditor'
import { CourtPhotoStrip } from '../components/CourtPhotoStrip'
import { useAuth } from '../lib/auth'
import { useLocation } from '../lib/location'
import { useCourt } from '../lib/queries'
import { CourtActions } from '../components/CourtActions'
import { ShareCourtButton } from '../components/ShareCourtButton'
import { MAP_NEARBY_RADIUS_KM } from '../lib/nearby'
import { GameCard } from '../components/GameCard'
import { CourtLeaderboard } from '../components/CourtLeaderboard'
import { CourtChallenges } from '../components/CourtChallenges'
import { DistanceText, Hourglass, Lightbulb, SearchX, SportName, X } from '../components/icons'
import { Card, Empty, PageHeader, Spinner, StatusPill } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { useListIntro } from '../lib/motion'

export function CourtPage() {
  const { id } = useParams()
  const { t } = useLocale()
  const { user } = useAuth()
  const { coords } = useLocation()
  const { data: court, isLoading } = useCourt(id, coords)
  const intro = useListIntro(court?.games.length ?? 0)
  const canEditCourt =
    !!user && !!court && (court.created_by === user.id || user.role === 'admin')

  if (isLoading) return <Loading />
  if (!court) return <Empty icon={<SearchX className="size-14" strokeWidth={1.5} />} title={t.courts.notFound} />

  return (
    <div className="pb-10">
      <PageHeader
        title={court.name}
        back={`/?court=${court.id}`}
        right={
          court.status === 'approved' ? (
            <ShareCourtButton courtId={court.id} courtName={court.name} variant="ghost" className="min-h-9 px-2" />
          ) : undefined
        }
      />
      {canEditCourt ? (
        id ? <CourtAddPhotos courtId={id} photos={court.photos} canManage={canEditCourt} /> : null
      ) : (
        <CourtPhotoStrip photos={court.photos} />
      )}

      <div className="mx-auto grid max-w-2xl gap-4 p-4">
        <CourtInfoEditor court={court} canEdit={canEditCourt} />
        {court.status !== 'approved' && (
          <p className="rounded-xl bg-players/20 p-3 text-sm font-medium">
            {court.status === 'pending' ? (
              <span className="inline-flex items-center gap-2">
                <Hourglass className="size-4 shrink-0" aria-hidden />
                {t.courts.pendingReview}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <X className="size-4 shrink-0" aria-hidden />
                {court.rejection_reason ? t.courts.rejectedReason.replace('{reason}', court.rejection_reason) : t.courts.rejected}
              </span>
            )}
          </p>
        )}
        {court.status === 'approved' &&
          court.distance_m != null &&
          court.distance_m > MAP_NEARBY_RADIUS_KM * 1000 && (
            <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
              {t.courts.openedFromLink.replace('{km}', String(MAP_NEARBY_RADIUS_KM))}
            </p>
          )}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusPill activity={court.activity} />
            {court.distance_m != null && (
              <span className="display text-2xl font-bold">
                <DistanceText iconClassName="size-5">{formatDistance(court.distance_m)}</DistanceText>
              </span>
            )}
          </div>
          <p className="display mt-3 text-4xl font-extrabold">
            {court.player_count} <span className="text-2xl text-ink-2">{t.courts.playersNow}</span>
          </p>
          <p className="text-sm text-ink-2">{t.courts.lastActivity.replace('{time}', timeAgo(court.last_activity_at))}</p>
          {court.status === 'approved' && (
            <div className="mt-4">
              <CourtActions court={court} games={court.games} me={coords} />
            </div>
          )}
        </Card>

        <section>
          <h2 className="display mb-2 text-2xl font-bold">{t.courts.games}</h2>
          {court.games.length ? (
            <div className={`grid gap-2 ${intro}`}>
              {court.games.map((g) => (
                <GameCard key={g.id} game={g} showCourt={false} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2">{t.courts.noGames}</p>
          )}
        </section>

        <CourtChallenges court={court} />

        <CourtLeaderboard courtId={court.id} />

        {!canEditCourt && (
          <Card>
            <h2 className="display mb-3 text-2xl font-bold">{t.courts.courtInfo}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Info
                label={t.courts.sports}
                value={
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {court.sports.map((s) => <SportName key={s.id} sport={s} />)}
                  </span>
                }
              />
              <Info label={t.courts.address} value={court.address} />
              <Info label={t.courts.openingHours} value={court.opening_hours} />
              <Info label={t.courts.surface} value={court.surface} />
              <Info
                label={t.courts.lighting}
                value={
                  court.lighting == null
                    ? null
                    : court.lighting
                      ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Lightbulb className="size-4 shrink-0" aria-hidden />
                            {t.courts.litAtNight}
                          </span>
                        )
                      : t.courts.noLights
                }
              />
            </dl>
            {court.description && <p className="mt-3 text-sm text-ink-2">{court.description}</p>}
          </Card>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: ReactNode | null | undefined }) {
  return (
    <>
      <dt className="font-semibold text-ink-2">{label}</dt>
      <dd>{value == null || value === '' ? '—' : value}</dd>
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
