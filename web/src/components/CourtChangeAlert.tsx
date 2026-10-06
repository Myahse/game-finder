import { useNavigate } from 'react-router-dom'
import { ArrowDown, MapPin, Navigation } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { useAckCourtChange, useCourtChanges } from '../lib/courtChanges'
import { directionsUrl, playerUsernameLabel } from '../lib/format'
import { Button } from './ui'

/** Pops up when a game or challenge I'm in was moved to another court. */
export function CourtChangeAlert({ enabled }: { enabled: boolean }) {
  const { t, locale } = useLocale()
  const tm = t.courtMove
  const navigate = useNavigate()
  const { data } = useCourtChanges(enabled)
  const ack = useAckCourtChange()
  const change = data?.[0]
  if (!enabled || !change) return null

  const who = change.changed_by ? playerUsernameLabel(change.changed_by) : 'Admin'
  const when = change.start_time
    ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(change.start_time))
    : null
  const dismiss = () => ack.mutate(change.id)
  const view = () => {
    dismiss()
    navigate(change.game_id ? `/games/${change.game_id}` : '/challenges')
  }

  return (
    <div
      className="ftg-safe-overlay ftg-safe-overlay-b fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="court-change-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl">
        <div className={`px-5 py-4 text-white ${change.reason === 'rain' ? 'bg-gradient-to-br from-sky-500 to-sky-800' : 'bg-gradient-to-br from-brand to-[var(--sport-deep,#7a1f00)]'}`}>
          <p className="text-4xl" aria-hidden>{change.reason === 'rain' ? '🌧️' : '📍'}</p>
          <h2 id="court-change-title" className="display mt-1 text-3xl font-extrabold">
            {change.challenge_id ? tm.alertChallenge : tm.alertGame}
          </h2>
          <p className="text-sm font-semibold opacity-90">{(change.reason === 'rain' ? tm.byRain : tm.by).replace('{u}', who)}</p>
        </div>
        <div className="p-5">
          {change.from_court && (
            <>
              <p className="text-xs font-semibold uppercase text-ink-2">{tm.from}</p>
              <p className="font-semibold text-ink-2 line-through">{change.from_court.name}</p>
              <ArrowDown className="my-1 size-5 text-brand" aria-hidden />
            </>
          )}
          <p className="text-xs font-semibold uppercase text-ink-2">{tm.to}</p>
          <p className="display flex items-center gap-1.5 text-2xl font-extrabold">
            <MapPin className="size-6 shrink-0 text-brand" aria-hidden /> {change.to_court.name}
          </p>
          {change.to_court.address && <p className="text-sm text-ink-2">{change.to_court.address}</p>}
          {(change.sport || when) && (
            <p className="mt-2 text-sm font-semibold">
              {[change.sport?.name, when].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={directionsUrl(change.to_court.latitude, change.to_court.longitude)}
              target="_blank"
              rel="noreferrer"
              className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 px-3 text-lg font-bold hover:bg-line"
            >
              <Navigation className="size-5 shrink-0" aria-hidden /> {tm.directions}
            </a>
            <Button type="button" variant="secondary" onClick={view}>
              {tm.view}
            </Button>
          </div>
          <Button type="button" className="mt-2 w-full" onClick={dismiss}>
            {tm.gotIt}
          </Button>
        </div>
      </div>
    </div>
  )
}
