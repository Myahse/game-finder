import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { MapRef } from 'react-map-gl/mapbox'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, uploadImage } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { useLocation, type Coords } from '../lib/location'
import { useAuth } from '../lib/auth'
import { useMySports } from '../lib/mySport'
import { LIST_NEARBY_RADIUS_KM } from '../lib/nearby'
import { useCourtsNearbySports, useSports } from '../lib/queries'
import type { Court } from '../lib/types'
import { CourtPlacementMap } from '../components/CourtPlacementMap'
import { MapSearchBar } from '../components/MapSearchBar'
import { Hourglass, Plus, SportName, X } from '../components/icons'
import { formatOpeningHours } from '../lib/openingHours'
import { reverseGeocode } from '../lib/reverseGeocode'
import { StepIndicator } from '../components/StepIndicator'
import { Button, ErrorText, Field, Input, Textarea } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

export function AddCourtPage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const { coords, center } = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const mySports = useMySports()
  const mapRef = useRef<MapRef>(null)
  const mapCenter = coords ?? center
  const sportSlugs = isAdmin ? [] : mySports.map((s) => s.slug)
  const nearbyQ = useCourtsNearbySports(mapCenter, sportSlugs, LIST_NEARBY_RADIUS_KM)
  const nearbyCourts = nearbyQ.data
  const { data: sports } = useSports()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [where, setWhere] = useState<Coords | null>(null)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [address, setAddress] = useState('')
  const [geocodingAddress, setGeocodingAddress] = useState(false)
  const [surface, setSurface] = useState('')
  const [lighting, setLighting] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [doneCourt, setDoneCourt] = useState<(Court & { reused_nearby?: boolean }) | null>(null)

  const toggleSport = (id: string) => setSportIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  useEffect(() => {
    if (!isAdmin && mySports.length) setSportIds([mySports[0].id])
  }, [mySports.map((s) => s.id).join(','), isAdmin])

  useEffect(() => {
    if (step !== 0) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [step])

  const onPickLocation = useCallback(async (c: Coords) => {
    setWhere(c)
    setGeocodingAddress(true)
    const addr = await reverseGeocode(c)
    if (addr) setAddress(addr)
    setGeocodingAddress(false)
  }, [])

  const pinMyPosition = () => {
    if (coords) void onPickLocation(coords)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    try {
      for (const f of Array.from(files).slice(0, 6 - photos.length)) {
        const url = await uploadImage(f, 'court')
        setPhotos((p) => [...p, url])
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!where) return setError(t.courts.add.placeCourt)
    setBusy(true)
    setError('')
    try {
      const court = await api<Court & { reused_nearby?: boolean }>('/api/courts', {
        method: 'POST',
        json: {
          name,
          latitude: where.latitude,
          longitude: where.longitude,
          sport_ids: sportIds,
          description: description || null,
          photos,
          opening_hours:
            opensAt.trim() && closesAt.trim() ? formatOpeningHours(opensAt.trim(), closesAt.trim()) : null,
          address: address.trim() || null,
          surface: surface.trim() || null,
          lighting: lighting === 'unknown' ? null : lighting === 'yes',
        },
      })
      setDoneCourt(court)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (done && doneCourt) {
    const reused = doneCourt.reused_nearby
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-8 text-center">
        <Hourglass className="size-16 text-brand" aria-hidden />
        <h1 className="display mt-3 text-5xl font-extrabold">{reused ? t.courts.add.alreadyHereTitle : t.courts.add.submittedTitle}</h1>
        <p className="mt-2 text-ink-2">
          {reused
            ? t.courts.add.alreadyHereBody
            : t.courts.add.submittedBody}
        </p>
        {doneCourt.status === 'approved' ? (
          <>
            <Button className="mt-4 w-full" variant="live" onClick={() => navigate(`/games/new?court=${doneCourt.id}`)}>
              {t.courts.add.createGame}
            </Button>
            <Button className="mt-2 w-full" onClick={() => navigate(`/?court=${doneCourt.id}`)}>
              {t.courts.add.viewOnMap}
            </Button>
          </>
        ) : (
          <Button className="mt-4 w-full" onClick={() => navigate(`/courts/${doneCourt.id}`)}>
            {t.courts.add.viewYourCourt}
          </Button>
        )}
      </div>
    )
  }

  const mapInitial = where ?? coords ?? center

  if (step === 0) {
    return createPortal(
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col bg-bg bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:inset-y-0 md:right-0 md:bottom-0 md:left-56"
      >
        <header className="relative z-20 shrink-0 border-b border-line bg-surface/95 px-3 pb-3 backdrop-blur pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <Link to="/" className="-ml-1 rounded-lg p-2 text-ink-2 hover:text-ink" aria-label={t.courts.backToMap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="display truncate text-2xl font-extrabold">{t.courts.add.placeTitle}</h1>
            </div>
            <StepIndicator current={1} total={2} />
          </div>
          <MapSearchBar
            className="mt-2"
            mapRef={mapRef}
            proximity={mapCenter}
            locationBias={coords}
            courts={nearbyCourts ?? []}
            placeholder={t.courts.add.searchPlaceholder}
          />
        </header>

        <div className="relative h-0 min-h-0 flex-1">
          <CourtPlacementMap
            mapRef={mapRef}
            value={where}
            initial={mapInitial}
            onChange={onPickLocation}
            me={coords}
            courts={nearbyCourts ?? []}
            className="absolute inset-0 size-full min-h-[12rem]"
            edgePinHint
          />
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-line bg-surface px-4 py-2">
          {coords && !where && (
            <button type="button" className="w-full py-1 text-center text-sm font-semibold text-brand" onClick={pinMyPosition}>
              {t.courts.add.pinMyPosition}
            </button>
          )}
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            type="button"
            className="w-full min-h-11 px-4 text-base"
            disabled={!where}
            onClick={() => {
              setError('')
              setStep(1)
            }}
          >
            {t.courts.add.nextDetails}
          </Button>
        </div>
      </div>,
      document.body,
    )
  }

  return (
    <form onSubmit={submit} className="min-h-full pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          className="-ml-2 rounded-lg p-2 text-ink-2 hover:text-ink"
          aria-label={t.courts.backToMap}
          onClick={() => setStep(0)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-3xl font-extrabold">{t.courts.add.detailsTitle}</h1>
        </div>
        <StepIndicator current={2} total={2} />
      </header>

      <div className="mx-auto grid max-w-md gap-5 p-5">
        <Field label={t.courts.add.name}>
          <Input
            required
            minLength={2}
            maxLength={80}
            placeholder={t.courts.add.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <p className="text-sm text-ink-2">
          {t.courts.add.pinPlaced}
          <button type="button" className="ml-2 font-semibold text-brand" onClick={() => setStep(0)}>
            {t.courts.add.adjustOnMap}
          </button>
        </p>
        <Field
          label={t.courts.sport}
          hint={!isAdmin ? t.courts.add.sportHint : undefined}
        >
          {!isAdmin && mySports.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mySports.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSport(s.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${
                    sportIds.includes(s.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface'
                  }`}
                >
                  <SportName sport={s} iconClassName="size-4" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sports?.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSport(s.id)}
                  aria-pressed={sportIds.includes(s.id)}
                  className={`rounded-xl border-2 px-3 py-2 font-semibold ${sportIds.includes(s.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
                >
                  <SportName sport={s} />
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label={t.courts.add.photosOptional}>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p} className="relative">
                <img src={resolveMediaUrl(p)} alt="" className="size-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                  className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink shadow hover:bg-surface-2"
                  aria-label={t.courts.removePhoto}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <label className="flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-ink-2">
                {uploading ? '…' : <Plus className="size-8" aria-hidden />}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </Field>
        <Field
          label={t.courts.add.addressOptional}
          hint={geocodingAddress ? t.courts.add.lookingUpAddress : t.courts.add.addressAuto}
        >
          <Input placeholder={t.courts.streetPlaceholder} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t.courts.add.hoursOptional} hint={t.courts.add.hours24}>
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" aria-label={t.courts.opens} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            <Input type="time" aria-label={t.courts.closes} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </Field>
        <Field label={t.courts.add.surfaceOptional}>
          <Input placeholder={t.courts.add.surfacePlaceholder} value={surface} onChange={(e) => setSurface(e.target.value)} />
        </Field>
        <Field label={t.courts.add.lightingOptional}>
          <select
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm"
            value={lighting}
            onChange={(e) => setLighting(e.target.value as 'unknown' | 'yes' | 'no')}
          >
            <option value="unknown">{t.courts.notSpecified}</option>
            <option value="yes">{t.courts.litAtNight}</option>
            <option value="no">{t.courts.noLights}</option>
          </select>
        </Field>
        <Field label={t.courts.add.descriptionOptional}>
          <Textarea maxLength={1000} placeholder={t.courts.add.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!sportIds.length || uploading}>
          {t.courts.add.submit}
        </Button>
      </div>
    </form>
  )
}
