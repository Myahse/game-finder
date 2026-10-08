import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
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
import { isAtCourt, notAtCourtMessage, notAtCourtTitle } from '../lib/courtProximity'
import { useLocation } from '../lib/location'
import { LIST_NEARBY_RADIUS_KM } from '../lib/nearby'
import { useAuth } from '../lib/auth'
import { useMySport, useMySports } from '../lib/mySport'
import { useCourtsNearbySports, useSports } from '../lib/queries'
import type { Game, GameType, SkillLevel } from '../lib/types'
import { Clock, Flame, SportIcon, SportName } from '../components/icons'
import { Plus } from 'lucide-react'
import { ShareGameButton } from '../components/ShareGameButton'
import { AppAlert, Button, ErrorText, Field, Input, PageHeader, Select } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CreateGamePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { t } = useLocale()
  const tc = t.games.create
  const mySport = useMySport()
  const mySports = useMySports()
  const isAdmin = user?.role === 'admin'
  const { center, coords } = useLocation()
  const { data: sports } = useSports()
  // Courts for any of my sports (main + extras), nearest first. Admins see all.
  const slugs = isAdmin ? [] : mySports.map((s) => s.slug)
  const { data: merged, isLoading: courtsLoading, error: courtsError } = useCourtsNearbySports(center, slugs, LIST_NEARBY_RADIUS_KM)
  const courts = useMemo(() => [...merged].sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)), [merged])
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

  // Same sport filter as the map's top chips: ?sport= (from the map), else the
  // sport of the court I came from, else my main sport. Courts follow it.
  const allowed = isAdmin ? active : mySports.filter((s) => s.active)
  const paramSport = params.get('sport')
  const paramCourt = params.get('court')
  useEffect(() => {
    if (sportId || allowed.length === 0) return
    const fromParam = allowed.find((s) => s.slug === paramSport)
    if (fromParam) return setSportId(fromParam.id)
    if (paramCourt) {
      const pc = courts.find((c) => c.id === paramCourt)
      if (!pc && courtsLoading) return
      const offered = pc && allowed.find((s) => pc.sports.some((cs) => cs.id === s.id))
      if (offered) return setSportId(offered.id)
    }
    setSportId((allowed.find((s) => s.id === mySport?.id) ?? allowed[0]).id)
  }, [sportId, allowed, paramSport, paramCourt, courts, courtsLoading, mySport?.id])
  const chosenSport = allowed.find((s) => s.id === sportId) ?? null
  const sportCourts = chosenSport ? courts.filter((c) => c.sports.some((cs) => cs.id === chosenSport.id)) : courts
  const pickSport = (id: string) => {
    setSportId(id)
    const c = courts.find((x) => x.id === courtId)
    if (c && !c.sports.some((cs) => cs.id === id)) setCourtId('')
  }

  const court = sportCourts.find((c) => c.id === courtId)
  const existingPhotos = (court?.photos ?? []).filter((p) => p.trim().length > 0)
  const suggestPlacePhoto = !!courtId && existingPhotos.length === 0 && placePhotos.length === 0

  useEffect(() => {
    setPlacePhotos([])
  }, [courtId])


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
        <h1 className="display mt-3 text-5xl font-extrabold">{tc.successTitle}</h1>
        <p className="mt-2 text-ink-2">
          {tc.successBody.replace('{court}', created.court.name)}
        </p>
        <Button className="mt-4 w-full" variant="live" onClick={() => navigate(`/games/${created.id}`, { replace: true })}>
          {tc.viewGame}
        </Button>
        <ShareGameButton
          gameId={created.id}
          title={`${created.court.name} · ${gameTypeLabels[created.game_type]}`}
          className="mt-2 w-full"
        />
      </div>
    )
  }

  return (
    <div className="pb-10">
      <AppAlert
        open={farModal}
        title={notAtCourtTitle()}
        message={notAtCourtMessage()}
        onClose={() => setFarModal(false)}
      />
      <PageHeader title={tc.title} back={courtId ? `/?court=${courtId}` : '/'} />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-5 p-5">
        <Field label={tc.sport}>
          {allowed.length <= 1 ? (
            <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 font-semibold">
              {chosenSport ? <SportName sport={chosenSport} /> : '—'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowed.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSport(s.id)}
                  aria-pressed={chosenSport?.id === s.id}
                  className={`rounded-xl border-2 px-4 py-2.5 font-semibold ${chosenSport?.id === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
                >
                  <SportName sport={s} />
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={tc.court} hint={<Link to="/courts/new" className="font-semibold text-brand">{tc.courtNotListed}</Link>}>
          <Select required value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            <option value="" disabled>
              {tc.chooseCourt}
            </option>
            {sportCourts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.distance_m != null ? `· ${formatDistance(c.distance_m)}` : ''}
              </option>
            ))}
          </Select>
          {courtsError ? (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-danger">
              {tc.courtsLoadFailed} {errorMessage(courtsError)}
              <button type="button" className="font-semibold text-brand" onClick={() => void qc.invalidateQueries({ queryKey: ['courts'] })}>
                {tc.retry}
              </button>
            </p>
          ) : (
            !courtsLoading && sportCourts.length === 0 && (
              <p className="mt-2 text-sm text-ink-2">
                {(chosenSport ? tc.noCourtsForSport.replace('{sport}', chosenSport.name) : tc.noCourtsNearby).replace('{km}', String(LIST_NEARBY_RADIUS_KM))}
              </p>
            )
          )}
        </Field>

        {courtId && (
          <Field
            label={tc.placePhoto}
            hint={
              existingPhotos.length
                ? tc.placePhotoHasPhotos
                : tc.placePhotoRecommended
            }
          >
            <div className="flex flex-wrap gap-2">
              {existingPhotos.map((p) => (
                <img key={p} src={resolveMediaUrl(p)} alt="" className="size-20 rounded-xl object-cover" />
              ))}
              {placePhotos.map((p) => (
                <img key={p} src={resolveMediaUrl(p)} alt="" className="size-20 rounded-xl object-cover ring-2 ring-brand" />
              ))}
              {existingPhotos.length + placePhotos.length < 6 && (
                <label className="flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-ink-2">
                  {uploading ? '…' : <Plus className="size-8" aria-hidden />}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => addPlacePhoto(e.target.files)}
                  />
                </label>
              )}
            </div>
          </Field>
        )}


        <Field label={tc.startTime}>
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
                    {tc.rightNow}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Clock className="size-4" aria-hidden />
                    {tc.later}
                  </span>
                )}
              </button>
            ))}
          </div>
          {when === 'later' && (
            <Input type="datetime-local" required value={start} min={minStart} onChange={(e) => setStart(e.target.value)} />
          )}
        </Field>

        <Field label={tc.maxPlayers.replace('{value}', maxPlayersSliderLabel(maxPlayersSlider))}>
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
            {tc.unlimitedHint.replace('{cap}', String(MAX_PLAYERS_SLIDER_CAP))}
          </p>
        </Field>

        <Field label={tc.skillLevel}>
          <Select value={skill} onChange={(e) => setSkill(e.target.value as SkillLevel)}>
            {(Object.keys(skillLabels) as SkillLevel[]).map((k) => (
              <option key={k} value={k}>
                {skillLabels[k]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={tc.gameType}>
          <Select value={type} onChange={(e) => setType(e.target.value as GameType)}>
            {(Object.keys(gameTypeLabels) as GameType[]).map((k) => (
              <option key={k} value={k}>
                {gameTypeLabels[k]}
              </option>
            ))}
          </Select>
        </Field>

        <ErrorText>{error}</ErrorText>
        {suggestPlacePhoto && (
          <p className="text-sm text-ink-2">{tc.noPhotoYet}</p>
        )}
        <Button type="submit" loading={busy} disabled={!courtId || !chosenSport || uploading}>
          {tc.submit}
        </Button>
      </form>
    </div>
  )
}
