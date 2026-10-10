import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card, Chip } from '../../components/ui'
import { SportName } from '../../components/icons'
import { StatTile } from '../../components/StatTile'
import { Odometer } from '../../components/Odometer'
import { Loading } from '../CourtPage'
import { currentLocale, useLocale } from '../../i18n/LocaleProvider'

interface Usage {
  days: number
  active: {
    dau: number
    wau: number
    mau: number
    period: number
    previous: number
    total_users: number
    new_users: number
    new_users_previous: number
    app_opens: number
    app_opens_previous: number
  }
  features: { key: string; count: number; previous: number }[]
  daily: { date: string; active: number; games: number }[]
  top_courts: { id: string; name: string; games: number }[]
  sports: { id: string; slug: string; name: string; games: number }[]
  retention: { cohort: number; returned: number }
}

const periods = [7, 30, 90] as const

export function AdminUsage() {
  const { t } = useLocale()
  const u = t.admin.usage
  const [days, setDays] = useState<number>(30)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'usage', days],
    queryFn: () => api<Usage>(`/api/admin/usage?days=${days}`),
    refetchInterval: 60_000,
  })

  const chips = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={u.periodLabel}>
      {periods.map((d) => (
        <Chip key={d} active={days === d} onClick={() => setDays(d)}>
          {u.period(d)}
        </Chip>
      ))}
    </div>
  )
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {chips}
        <Loading />
      </div>
    )
  }

  const a = data.active
  const tiles: [string, number, number?][] = [
    [u.dau, a.dau],
    [u.wau, a.wau],
    [u.mau, a.mau],
    [u.inPeriod(data.days), a.period, a.previous],
    [u.newPlayers(data.days), a.new_users, a.new_users_previous],
    [u.appOpens(data.days), a.app_opens, a.app_opens_previous],
  ]
  const used = data.features.filter((f) => f.count > 0).sort((x, y) => y.count - x.count)
  const unused = data.features.filter((f) => f.count === 0)
  const maxFeature = Math.max(1, ...used.map((f) => f.count))
  const maxCourt = Math.max(1, ...data.top_courts.map((c) => c.games))
  const totalSportGames = data.sports.reduce((s, x) => s + x.games, 0)
  const pct = data.retention.cohort ? Math.round((data.retention.returned / data.retention.cohort) * 100) : null

  return (
    <div className="grid grid-cols-1 gap-4">
      {chips}

      <section className="grid grid-cols-1 gap-2">
        <div>
          <h2 className="display text-2xl font-bold">{u.activePlayers}</h2>
          <p className="text-sm text-ink-2">{u.activeHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map(([label, value, previous]) => (
            <StatTile
              key={label}
              label={label}
              value={value}
              footer={previous !== undefined && <Delta count={value} previous={previous} />}
            />
          ))}
        </div>
        <p className="text-sm text-ink-2">
          {u.totalPlayers(a.total_users)} · {u.vsPrevious(data.days)}
        </p>
      </section>

      <Card>
        <h2 className="display mb-3 text-2xl font-bold">{u.daily}</h2>
        <div className="grid grid-cols-1 gap-5">
          <DailyBars label={u.activePerDay} days={data.daily} value={(d) => d.active} barClass="fill-brand" />
          <DailyBars label={u.gamesPerDay} days={data.daily} value={(d) => d.games} barClass="fill-live" />
        </div>
      </Card>

      <Card>
        <h2 className="display text-2xl font-bold">{u.features}</h2>
        <p className="mb-3 text-sm text-ink-2">{u.featuresHint(data.days)}</p>
        <ol className="grid grid-cols-1 gap-2">
          {used.map((f) => (
            <BarRow
              key={f.key}
              label={u.feature[f.key] ?? f.key}
              right={
                <>
                  <span className="font-semibold text-ink">{f.count}</span>
                  <Delta count={f.count} previous={f.previous} compact />
                </>
              }
              share={f.count / maxFeature}
            />
          ))}
        </ol>
        {unused.length > 0 && (
          <div className={used.length ? 'mt-4 border-t border-line pt-3' : ''}>
            <p className="text-xs font-semibold uppercase text-ink-2">{u.unused}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {unused.map((f) => (
                <li key={f.key} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                  {u.feature[f.key] ?? f.key}
                  {f.previous > 0 && <span className="ml-1 text-danger">▼ {f.previous}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="display mb-3 text-2xl font-bold">{u.topCourts}</h2>
          {data.top_courts.length === 0 && <p className="text-sm text-ink-2">{u.noGames}</p>}
          <ol className="grid grid-cols-1 gap-2">
            {data.top_courts.map((c) => (
              <BarRow key={c.id} label={c.name} right={u.games(c.games)} share={c.games / maxCourt} />
            ))}
          </ol>
        </Card>
        <Card>
          <h2 className="display mb-3 text-2xl font-bold">{u.sports}</h2>
          {data.sports.length === 0 && <p className="text-sm text-ink-2">{u.noGames}</p>}
          <ol className="grid grid-cols-1 gap-2">
            {data.sports.map((s) => (
              <BarRow
                key={s.id}
                label={<SportName sport={s} />}
                right={`${u.games(s.games)} · ${Math.round((s.games / Math.max(1, totalSportGames)) * 100)} %`}
                share={s.games / Math.max(1, totalSportGames)}
                barClass="bg-live"
              />
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="display text-2xl font-bold">{u.retention}</h2>
        {pct === null ? (
          <p className="mt-1 text-sm text-ink-2">{u.retentionEmpty}</p>
        ) : (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="display text-5xl font-extrabold tabular-nums">
              <Odometer value={pct} /> %
            </p>
            <p className="min-w-0 flex-1 basis-56 text-sm text-ink-2">
              {u.retentionText(data.retention.returned, data.retention.cohort)}
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function BarRow({
  label,
  right,
  share,
  barClass = 'bg-brand',
}: {
  label: ReactNode
  right: ReactNode
  share: number
  barClass?: string
}) {
  return (
    <li className="min-w-0 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{label}</p>
        <p className="flex shrink-0 items-baseline gap-2 tabular-nums text-ink-2">{right}</p>
      </div>
      <div className="mt-1 h-2 rounded-full bg-surface-2">
        <div className={`ftg-hbar-grow h-2 rounded-full ${barClass}`} style={{ width: `${Math.min(1, share) * 100}%` }} />
      </div>
    </li>
  )
}

function Delta({ count, previous, compact }: { count: number; previous: number; compact?: boolean }) {
  const { t } = useLocale()
  const Tag = compact ? 'span' : 'p'
  if (count === previous) {
    return <Tag className={`text-xs tabular-nums text-ink-2 ${compact ? '' : 'mt-1'}`}>= {previous}</Tag>
  }
  const up = count > previous
  const text =
    previous === 0 ? t.admin.usage.newBadge : `${Math.round((Math.abs(count - previous) / previous) * 100)} %`
  return (
    <Tag
      className={`text-xs font-semibold tabular-nums ${up ? 'text-live' : 'text-danger'} ${compact ? '' : 'mt-1'}`}
      title={String(previous)}
    >
      {up ? '▲' : '▼'} {text}
      {!compact && <span className="font-normal text-ink-2"> · {previous}</span>}
    </Tag>
  )
}

function DailyBars({
  label,
  days,
  value,
  barClass,
}: {
  label: string
  days: Usage['daily']
  value: (d: Usage['daily'][number]) => number
  barClass: string
}) {
  const { t } = useLocale()
  const values = days.map(value)
  const max = Math.max(1, ...values)
  const step = 10
  const height = 60
  const curve = useRef<SVGPathElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const key = values.join(',')
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${(i * step + step / 2).toFixed(1)} ${(height - (v / max) * height * 0.92).toFixed(1)}`)
    .join(' ')
  // The line over the bars draws itself from the left, a dot riding its tip.
  useLayoutEffect(() => {
    const line = curve.current
    const tip = dot.current
    if (!line || !tip || values.length < 2) return
    const L = line.getTotalLength()
    const W = values.length * step
    line.style.strokeDasharray = `${L}`
    line.style.strokeDashoffset = `${L}`
    let raf = 0
    const t0 = performance.now() + 250
    const frame = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / 1100))
      const e = 1 - Math.pow(1 - k, 3)
      line.style.strokeDashoffset = `${L * (1 - e)}`
      const p = line.getPointAtLength(L * e)
      tip.style.left = `${(p.x / W) * 100}%`
      tip.style.top = `${(p.y / height) * 100}%`
      if (k < 1) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' })
  return (
    <figure>
      <figcaption className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-ink-2">{t.admin.usage.peak(Math.max(0, ...values))}</span>
      </figcaption>
      <div className="relative">
      <svg
        viewBox={`0 0 ${days.length * step} ${height}`}
        preserveAspectRatio="none"
        className="block h-20 w-full"
        role="img"
        aria-label={label}
      >
        {days.map((day, i) => {
          const v = values[i]
          const h = v ? Math.max(2, (v / max) * height) : 1
          return (
            <rect
              key={day.date}
              x={i * step + step * 0.15}
              y={height - h}
              width={step * 0.7}
              height={h}
              rx={Math.min(2, step * 0.2)}
              className={`ftg-bar-grow ${v ? barClass : 'fill-line'}`}
              style={{ ['--d' as string]: `${i * 18}ms` }}
            >
              <title>{`${fmt(day.date)} · ${v}`}</title>
            </rect>
          )
        })}
      </svg>
      {values.length > 1 && (
        <>
          <svg viewBox={`0 0 ${days.length * step} ${height}`} preserveAspectRatio="none" className="ftg-curve" aria-hidden>
            <path ref={curve} d={d} />
          </svg>
          <span ref={dot} className="ftg-curve-dot" aria-hidden />
        </>
      )}
      </div>
      {days.length > 0 && (
        <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-2">
          <span>{fmt(days[0].date)}</span>
          <span>{fmt(days[days.length - 1].date)}</span>
        </div>
      )}
    </figure>
  )
}
