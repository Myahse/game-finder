import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { formatDistance, gameTypeLabels, skillLabels } from '../lib/format'
import { useLocation } from '../lib/location'
import { useCourtsNearby, useSports } from '../lib/queries'
import type { Game, GameType, SkillLevel } from '../lib/types'
import { Button, ErrorText, Field, Input, PageHeader, Select } from '../components/ui'

function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateGamePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { center } = useLocation()
  const { data: sports } = useSports()
  const { data: courts } = useCourtsNearby(center, null)
  const active = sports?.filter((s) => s.active) ?? []

  const [courtId, setCourtId] = useState(params.get('court') ?? '')
  const [sportId, setSportId] = useState('')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [start, setStart] = useState(() => localInputValue(new Date(Date.now() + 60 * 60_000)))
  const [minStart] = useState(() => localInputValue(new Date()))
  const [maxPlayers, setMaxPlayers] = useState(10)
  const [skill, setSkill] = useState<SkillLevel>('all_levels')
  const [type, setType] = useState<GameType>('pickup')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Game | null>(null)

  const court = courts?.find((c) => c.id === courtId)
  const courtSports = court ? active.filter((s) => court.sports.some((cs) => cs.id === s.id)) : active
  const chosenSport = courtSports.find((s) => s.id === sportId) ?? courtSports[0]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!chosenSport) return
    setBusy(true)
    setError('')
    try {
      const game = await api<Game>('/api/games', {
        method: 'POST',
        json: {
          court_id: courtId,
          sport_id: chosenSport.id,
          start_time: when === 'now' ? new Date().toISOString() : new Date(start).toISOString(),
          max_players: maxPlayers,
          skill_level: skill,
          game_type: type,
        },
      })
      qc.invalidateQueries({ queryKey: ['court', courtId] })
      qc.invalidateQueries({ queryKey: ['my-games'] })
      setCreated(game)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (created) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-8 text-center">
        <p className="text-6xl" aria-hidden>
          {created.sport.icon}
        </p>
        <h1 className="display mt-3 text-5xl font-extrabold">Game created successfully.</h1>
        <p className="mt-2 text-ink-2">
          You're in. Players near {created.court.name} can see it now.
        </p>
        <Button className="mt-8 w-full" variant="live" onClick={() => navigate(`/games/${created.id}`, { replace: true })}>
          View game
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Create game" back={courtId ? `/?court=${courtId}` : '/'} />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-5 p-5">
        <Field label="Court" hint={<Link to="/courts/new" className="font-semibold text-brand">Court not listed? Add it →</Link>}>
          <Select required value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value="" disabled>
              Choose a court
            </option>
            {courts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.distance_m != null ? `· ${formatDistance(c.distance_m)}` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sport">
          <div className="flex flex-wrap gap-2">
            {courtSports.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSportId(s.id)}
                aria-pressed={chosenSport?.id === s.id}
                className={`rounded-xl border-2 px-4 py-2.5 font-semibold ${chosenSport?.id === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Start time">
          <div className="mb-2 grid grid-cols-2 gap-2">
            {(['now', 'later'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWhen(w)}
                aria-pressed={when === w}
                className={`rounded-xl border-2 py-2.5 font-semibold ${when === w ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              >
                {w === 'now' ? '🔥 Right now' : '🕕 Later'}
              </button>
            ))}
          </div>
          {when === 'later' && (
            <Input type="datetime-local" required value={start} min={minStart} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>

        <Field label={`Maximum players: ${maxPlayers}`}>
          <input
            type="range"
            min={2}
            max={30}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </Field>

        <Field label="Skill level">
          <Select value={skill} onChange={(e) => setSkill(e.target.value as SkillLevel)}>
            {(Object.keys(skillLabels) as SkillLevel[]).map((k) => (
              <option key={k} value={k}>
                {skillLabels[k]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Game type">
          <Select value={type} onChange={(e) => setType(e.target.value as GameType)}>
            {(Object.keys(gameTypeLabels) as GameType[]).map((k) => (
              <option key={k} value={k}>
                {gameTypeLabels[k]}
              </option>
            ))}
          </Select>
        </Field>

        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!courtId || !chosenSport}>
          Create game
        </Button>
      </form>
    </div>
  )
}
