import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CloudRain, Droplets, Wind } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { api, errorMessage } from '../lib/api'
import { qk, useGameAction } from '../lib/queries'
import type { Game } from '../lib/types'
import { drierSlot, hoursFor, isRainy, useCourtWeather, weatherIcons, weatherKind, worstRain } from '../lib/weather'
import { Button, Card, ErrorText } from './ui'

/** Forecast for the game window + a "rain check" when rain is likely. */
export function GameWeather({ game, isHost }: { game: Game; isHost: boolean }) {
  const { t, locale } = useLocale()
  const open = game.status === 'scheduled' || game.status === 'active'
  const { data: forecast, isError } = useCourtWeather(game.court_id, open)
  const qc = useQueryClient()
  const cancel = useGameAction()
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const move = useMutation({
    mutationFn: (at: Date) => api<Game>(`/api/games/${game.id}`, { method: 'PATCH', json: { start_time: at.toISOString() } }),
    onSuccess: (g) => {
      qc.setQueryData(qk.game(g.id), (old: Game | undefined) => ({ ...old, ...g }))
      void qc.invalidateQueries({ queryKey: qk.myGames })
      setNote(t.weather.moved.replace('{t}', time(new Date(g.start_time))))
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (!open) return null
  const start = new Date(game.start_time)
  const window = hoursFor(forecast, start, game.duration_minutes)
  if (isError || (forecast && window.length === 0)) return null
  if (!forecast) return null

  function time(d: Date) {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d)
  }

  const main = window[0]
  const kind = weatherKind(main.code)
  const Icon = weatherIcons[kind]
  const rainy = isRainy(window)
  const rain = worstRain(window)
  const slot = rainy && game.status === 'scheduled' ? drierSlot(forecast, start, game.duration_minutes) : null

  return (
    <Card className={rainy ? 'ring-2 ring-sky-500/50' : ''}>
      <h2 className="display text-xl font-bold text-ink-2">{t.weather.title}</h2>
      <div className="mt-2 flex items-center gap-4">
        <Icon className={`size-14 shrink-0 ${rainy ? 'text-sky-500' : 'text-amber-500'}`} aria-hidden strokeWidth={1.6} />
        <div className="min-w-0 flex-1">
          <p className="display text-4xl font-extrabold leading-none">{Math.round(main.temp)}°</p>
          <p className="font-semibold">{t.weather.codes[kind]}</p>
        </div>
        <div className="grid gap-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1">
            <Droplets className="size-4" aria-hidden /> {rain}% {t.weather.rain}
          </span>
          <span className="inline-flex items-center gap-1">
            <Wind className="size-4" aria-hidden /> {Math.round(main.wind_kmh)} km/h
          </span>
        </div>
      </div>

      {window.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {window.slice(0, 6).map((h) => {
            const HIcon = weatherIcons[weatherKind(h.code)]
            return (
              <div key={h.t} className="flex min-w-16 flex-col items-center rounded-xl bg-surface-2 px-2 py-1.5 text-xs">
                <span className="font-semibold text-ink-2">{time(new Date(h.t * 1000))}</span>
                <HIcon className="my-0.5 size-5" aria-hidden />
                <span className="font-bold">{Math.round(h.temp)}°</span>
                <span className={h.rain_pct >= 50 ? 'font-bold text-sky-600' : 'text-ink-2'}>{h.rain_pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {rainy ? (
        <div className="mt-3 rounded-xl bg-sky-500/10 p-3">
          <p className="display flex items-center gap-1.5 text-lg font-bold text-sky-700 dark:text-sky-300">
            <CloudRain className="size-5" aria-hidden /> {t.weather.rainCheckTitle}
          </p>
          <p className="text-sm">{t.weather.rainCheckBody.replace('{p}', String(rain))}</p>
          {slot && (
            <p className="mt-1 text-sm font-semibold">{t.weather.drierAt.replace('{t}', time(slot.at)).replace('{p}', String(slot.rain))}</p>
          )}
          {isHost ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {slot && (
                <Button type="button" className="text-base" loading={move.isPending} onClick={() => (setError(''), move.mutate(slot.at))}>
                  {t.weather.moveTo.replace('{t}', time(slot.at))}
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                className={`text-base ${slot ? '' : 'col-span-2'}`}
                loading={cancel.isPending}
                onClick={() => {
                  if (!confirm(t.weather.callOffConfirm)) return
                  setError('')
                  cancel.mutate({ id: game.id, action: 'cancel', reason: t.weather.callOffReason }, { onError: (e) => setError(errorMessage(e)) })
                }}
              >
                {t.weather.callOff}
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-2">{t.weather.hostOnly}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-2">{t.weather.looksGood}</p>
      )}
      <ErrorText>{error}</ErrorText>
      {note && <p className="mt-2 text-sm font-semibold text-live">{note}</p>}
      <p className="mt-2 text-right text-[10px] text-ink-2">
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
          Weather data by Open-Meteo.com
        </a>
      </p>
    </Card>
  )
}
