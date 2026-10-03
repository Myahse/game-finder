import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import {
  formatDistance,
  gameTypeLabels,
  MAX_PLAYERS_SLIDER_CAP,
  MAX_PLAYERS_SLIDER_MIN,
  MAX_PLAYERS_SLIDER_UNLIMITED,
  maxPlayersSliderLabel,
  maxPlayersSliderToApi,
  skillLabels,
} from '../lib/format'
import { isAtCourt, NOT_AT_COURT_MESSAGE, NOT_AT_COURT_TITLE } from '../lib/courtProximity'
import { useLocation } from '../lib/location'
import { LIST_NEARBY_RADIUS_KM } from '../lib/nearby'
import { useAuth } from '../lib/auth'
import { useMySport } from '../lib/mySport'
import { useCourtsNearby, useSports } from '../lib/queries'
import type { Game, GameType, SkillLevel } from '../lib/types'
import { Clock, Flame, SportIcon, SportName } from '../components/icons'
import { Plus } from 'lucide-react'
import { AppAlert, Button, ErrorText, Field, Input, PageHeader, Select } from '../components/ui'

function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateGamePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const mySport = useMySport()
  const { center, coords } = useLocation()
  const { data: sports } = useSports()
  const sportSlug = user?.role === 'admin' ? null : mySport?.slug ?? null
  const { data: courts } = useCourtsNearby(center, sportSlug, LIST_NEARBY_RADIUS_KM)
  const active = sports?.filter((s) => s.active) ?? []

  const [courtId, setCourtId] = useState(params.get('court') ?? '')
  const [sportId, setSportId] = useState('')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [start, setStart] = useState(() => localInputValue(new Date(Date.now() + 60 * 60_000)))
  const [minStart] = useState(() => localInputValue(new Date()))
  const [maxPlayersSlider, setMaxPlayersSlider] = useState(10)
  const [skill, setSkill] = useState<SkillLevel>('all_levels')
  const [type, setType] = useState<GameType>('pickup')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Game | null>(null)
  const [placePhotos, setPlacePhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [farModal, setFarModal] = useState(false)

  const court = courts?.find((c) => c.id === courtId)
  const existingPhotos = court?.photos ?? []
  const needsPlacePhoto = !!courtId && existingPhotos.length === 0 && placePhotos.length === 0

  useEffect(() => {
    setPlacePhotos([])
  }, [courtId])

  useEffect(() => {
    if (mySport) setSportId(mySport.id)
  }, [mySport?.id])

  const courtSports = court ? active.filter((s) => court.sports.some((cs) => cs.id === s.id)) : active
  const lockedSport = mySport && user?.role !== 'admin' ? mySport : null
  const selectableSports = lockedSport ? courtSports.filter((s) => s.id === lockedSport.id) : courtSports
  const chosenSport = selectableSports.find((s) => s.id === sportId) ?? selectableSports[0] ?? lockedSport

  const addPlacePhoto = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    try {
      const f = files[0]
      const url = await uploadImage(f, 'court')
      setPlacePhotos((p) => (p.length ? p : [url]))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!chosenSport) return
    if (needsPlacePhoto) {
      setError('Add a photo of the court so others can find the place.')
      return
    }
    if (when === 'now' && court && !isAtCourt(coords, court)) {
      setFarModal(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const game = await api<Game>('/api/games', {
        method: 'POST',
        json: {
          court_id: courtId,
          sport_id: chosenSport.id,
          start_time: when === 'now' ? new Date().toISOString() : new Date(start).toISOString(),
          max_players: maxPlayersSliderToApi(maxPlayersSlider),
          skill_level: skill,
          game_type: type,
          court_photos: placePhotos,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
        },
      })
      qc.invalidateQueries({ queryKey: ['court', courtId] })
      qc.invalidateQueries({ queryKey: ['my-games'] })
      qc.invalidateQueries({ queryKey: ['games-nearby'] })
      qc.invalidateQueries({ queryKey: ['courts'] })
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
        <SportIcon slug={created.sport.slug} className="size-16 text-brand" />
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
      <AppAlert
        open={farModal}
        title={NOT_AT_COURT_TITLE}
        message={NOT_AT_COURT_MESSAGE}
        onClose={() => setFarModal(false)}
      />
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

        {courtId && (
          <Field
            label="Photo of the place"
            hint={
              existingPhotos.length
                ? 'This court already has photos. You can add another (optional).'
                : 'Required — show players what the court looks like.'
            }
          >
            <div className="flex flex-wrap gap-2">
              {existingPhotos.map((p) => (
                <img key={p} src={p} alt="" className="size-20 rounded-xl object-cover" />
              ))}
              {placePhotos.map((p) => (
                <img key={p} src={p} alt="" className="size-20 rounded-xl object-cover ring-2 ring-brand" />
              ))}
              {existingPhotos.length + placePhotos.length < 6 && (
                <label className="flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-ink-2">
                  {uploading ? '…' : <Plus className="size-8" aria-hidden />}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => addPlacePhoto(e.target.files)}
                  />
                </label>
              )}
            </div>
          </Field>
        )}

        <Field label="Sport">
          {lockedSport ? (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 font-semibold">
              <SportName sport={lockedSport} />
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectableSports.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSportId(s.id)}
                  aria-pressed={chosenSport?.id === s.id}
                  className={`rounded-xl border-2 px-4 py-2.5 font-semibold ${chosenSport?.id === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
                >
                  <SportName sport={s} />
                </button>
              ))}
            </div>
          )}
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
                {w === 'now' ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Flame className="size-4" aria-hidden />
                    Right now
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Clock className="size-4" aria-hidden />
                    Later
                  </span>
                )}
              </button>
            ))}
          </div>
          {when === 'later' && (
            <Input type="datetime-local" required value={start} min={minStart} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>

        <Field label={`Maximum players: ${maxPlayersSliderLabel(maxPlayersSlider)}`}>
          <input
            type="range"
            min={MAX_PLAYERS_SLIDER_MIN}
            max={MAX_PLAYERS_SLIDER_UNLIMITED}
            step={1}
            value={maxPlayersSlider}
            onChange={(e) => setMaxPlayersSlider(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
          <p className="mt-1 text-xs text-ink-2">
            Drag to the end for unlimited players ({MAX_PLAYERS_SLIDER_CAP}+).
          </p>
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
        <Button type="submit" loading={busy} disabled={!courtId || !chosenSport || uploading || needsPlacePhoto}>
          Create game
        </Button>
      </form>
    </div>
  )
}
