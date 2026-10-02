import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, uploadImage } from '../lib/api'
import { resolveMediaUrl } from '../lib/mediaUrl'
import { useLocation, type Coords } from '../lib/location'
import { useAuth } from '../lib/auth'
import { useMySport } from '../lib/mySport'
import { useSports } from '../lib/queries'
import type { Court } from '../lib/types'
import { Hourglass, Plus, SportName } from '../components/icons'
import { LocationPicker } from '../components/LocationPicker'
import { formatOpeningHours } from '../lib/openingHours'
import { reverseGeocode } from '../lib/reverseGeocode'
import { Button, ErrorText, Field, Input, PageHeader, Textarea } from '../components/ui'

export function AddCourtPage() {
  const navigate = useNavigate()
  const { coords, center } = useLocation()
  const { user } = useAuth()
  const mySport = useMySport()
  const { data: sports } = useSports()
  const isAdmin = user?.role === 'admin'
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
    if (mySport && !isAdmin) setSportIds([mySport.id])
  }, [mySport?.id, isAdmin])

  const onPickLocation = useCallback(async (c: Coords) => {
    setWhere(c)
    setGeocodingAddress(true)
    const addr = await reverseGeocode(c)
    if (addr) setAddress(addr)
    setGeocodingAddress(false)
  }, [])

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
    if (!where) return setError('Tap the map to place the court.')
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
        <h1 className="display mt-3 text-5xl font-extrabold">{reused ? 'Court already here' : 'Court on the map'}</h1>
        <p className="mt-2 text-ink-2">
          {reused
            ? 'Nobody was playing at this spot — we linked you to the existing court. Others can start a game here.'
            : 'Your court is on the map now (pending review). Anyone nearby can create a game when the court is quiet.'}
        </p>
        <Button className="mt-4 w-full" variant="live" onClick={() => navigate(`/games/new?court=${doneCourt.id}`)}>
          Create a game
        </Button>
        <Button className="mt-2 w-full" onClick={() => navigate(`/?court=${doneCourt.id}`)}>
          View on map
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Add a court" back="/" />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-5 p-5">
        <Field label="Name">
          <Input required minLength={2} maxLength={80} placeholder="e.g. Terrain Mockeyville" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Location" hint={coords ? 'Centered on you. Drag the pin to adjust.' : undefined}>
          <LocationPicker value={where} initial={center} onChange={onPickLocation} />
          {coords && !where && (
            <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => onPickLocation(coords)}>
              I'm at the court now
            </button>
          )}
        </Field>
        <Field label="Sport" hint={!isAdmin ? 'Your account sport — courts are tagged for your game type only.' : undefined}>
          {mySport && !isAdmin ? (
            <p className="flex items-center gap-2 rounded-xl border border-brand bg-brand/10 px-4 py-3 font-semibold">
              <SportName sport={mySport} />
            </p>
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
        <Field label="Photos (optional)">
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <img key={p} src={resolveMediaUrl(p)} alt="" className="size-20 rounded-xl object-cover" />
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
          label="Address (optional)"
          hint={geocodingAddress ? 'Looking up address from the map…' : 'Filled automatically from the pin. You can edit it.'}
        >
          <Input placeholder="Street or place name" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Opening hours (optional)" hint="24-hour format">
          <div className="grid grid-cols-2 gap-3">
            <Input type="time" aria-label="Opens" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
            <Input type="time" aria-label="Closes" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </div>
        </Field>
        <Field label="Surface (optional)">
          <Input placeholder="e.g. Concrete, grass" value={surface} onChange={(e) => setSurface(e.target.value)} />
        </Field>
        <Field label="Lighting (optional)">
          <select
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm"
            value={lighting}
            onChange={(e) => setLighting(e.target.value as 'unknown' | 'yes' | 'no')}
          >
            <option value="unknown">Not specified</option>
            <option value="yes">Lit at night</option>
            <option value="no">No lights</option>
          </select>
        </Field>
        <Field label="Description (optional)">
          <Textarea maxLength={1000} placeholder="Hoops, surface, lights, best times…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={!sportIds.length || uploading}>
          Submit court
        </Button>
      </form>
    </div>
  )
}
