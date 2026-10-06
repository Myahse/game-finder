import { useEffect, useMemo, useState } from 'react'
import { CloudRain, MapPin, X } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { errorMessage } from '../lib/api'
import { useMoveCourt, type CourtMoveReason } from '../lib/courtChanges'
import { formatDistance } from '../lib/format'
import { useCourtsNearby } from '../lib/queries'
import type { Court } from '../lib/types'
import { useCourtsRain } from '../lib/weather'
import { Button, ErrorText, Spinner } from './ui'

type CurrentCourt = Pick<Court, 'id' | 'name' | 'latitude' | 'longitude'>

/** "Change court" button + sheet, for the game host or the challenger. */
export function MoveCourtButton(props: Omit<SheetProps, 'onClose'> & { className?: string; variant?: 'secondary' | 'ghost' | 'primary' }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const { className = '', variant = 'secondary', ...sheet } = props
  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        <MapPin className="size-5" aria-hidden /> {t.courtMove.button}
      </Button>
      {open && <MoveCourtSheet {...sheet} onClose={() => setOpen(false)} />}
    </>
  )
}

type SheetProps = {
  kind: 'game' | 'challenge'
  id: string
  sportId: string
  sportSlug: string | null
  court: CurrentCourt
  defaultReason?: CourtMoveReason
  onClose: () => void
}

export function MoveCourtSheet({ kind, id, sportId, sportSlug, court, defaultReason, onClose }: SheetProps) {
  const { t } = useLocale()
  const tm = t.courtMove
  const move = useMoveCourt()
  const center = useMemo(() => ({ latitude: court.latitude, longitude: court.longitude }), [court.latitude, court.longitude])
  const { data: courts, isLoading } = useCourtsNearby(center, sportSlug, 20)
  const options = useMemo(
    () =>
      (courts ?? [])
        .filter((c) => c.id !== court.id && c.sports?.some((s) => s.id === sportId))
        .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))
        .slice(0, 12),
    [courts, court.id, sportId],
  )
  const { data: rain } = useCourtsRain([court.id, ...options.map((c) => c.id)])
  const rainHere = rain?.[court.id]
  const [reason, setReason] = useState<CourtMoveReason>(defaultReason ?? 'other')
  const [picked, setPicked] = useState('')
  const [error, setError] = useState('')

  // Rain at the current court: default the reason to rain and prefer a dry court.
  useEffect(() => {
    if (rainHere && !defaultReason) setReason('rain')
  }, [rainHere, defaultReason])
  useEffect(() => {
    if (picked || !options.length) return
    const dry = options.find((c) => !rain?.[c.id])
    setPicked((dry ?? options[0]).id)
  }, [options, rain, picked])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    setError('')
    move.mutate(
      { kind, id, court_id: picked, reason },
      {
        onSuccess: () => {
          toast.success(tm.done)
          onClose()
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )
  }

  return (
    <div className="ftg-safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={tm.title} onClick={onClose}>
      <div className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{tm.title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-ink-2">{tm.current}</span>
            <span className="block truncate font-bold">{court.name}</span>
          </span>
          {rainHere && <RainTag pct={rainHere.rain_pct} />}
        </div>
        {rainHere && <p className="-mt-1 mb-3 text-sm font-semibold text-sky-700 dark:text-sky-300">{tm.rainHint}</p>}

        <p className="mb-1 text-sm font-semibold text-ink-2">{tm.why}</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(['rain', 'other'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={`rounded-xl px-3 py-2 font-bold ${reason === r ? (r === 'rain' ? 'bg-sky-600 text-white' : 'bg-ink text-bg') : 'bg-surface-2'}`}
            >
              {tm[r]}
            </button>
          ))}
        </div>

        <p className="mb-1 text-sm font-semibold text-ink-2">{tm.pick}</p>
        {isLoading ? (
          <Spinner className="mb-3 text-brand" />
        ) : options.length === 0 ? (
          <p className="mb-3 text-sm text-ink-2">{tm.noCourts}</p>
        ) : (
          <div className="mb-3 grid gap-1.5">
            {options.map((c) => {
              const r = rain?.[c.id]
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c.id)}
                  aria-pressed={c.id === picked}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left ${c.id === picked ? 'bg-brand/10 ring-2 ring-brand' : 'bg-surface-2'}`}
                >
                  <span className="min-w-0 truncate font-semibold">{c.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-ink-2">
                    {r && <RainTag pct={r.rain_pct} />}
                    {c.distance_m != null && formatDistance(c.distance_m)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <p className="text-xs text-ink-2">{tm.notify}</p>
        <ErrorText>{error}</ErrorText>
        <Button type="button" className="mt-3 w-full" onClick={submit} loading={move.isPending} disabled={!picked}>
          <MapPin className="size-5" aria-hidden /> {tm.confirm}
        </Button>
      </div>
    </div>
  )
}

function RainTag({ pct }: { pct: number }) {
  const { t } = useLocale()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-700 dark:text-sky-300">
      <CloudRain className="size-3.5" aria-hidden /> {t.courtMove.rainSoon.replace('{p}', String(pct))}
    </span>
  )
}
