import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, uploadImage } from '../lib/api'
import { useLocation, type Coords } from '../lib/location'
import { useSports } from '../lib/queries'
import type { Court } from '../lib/types'
import { LocationPicker } from '../components/LocationPicker'
import { Button, ErrorText, Field, Input, PageHeader, Textarea } from '../components/ui'

export function AddCourtPage() {
  const navigate = useNavigate()
  const { coords, center } = useLocation()
  const { data: sports } = useSports()
  const [name, setName] = useState('')
  const [where, setWhere] = useState<Coords | null>(null)
  const [sportIds, setSportIds] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const toggleSport = (id: string) => setSportIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

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
      await api<Court>('/api/courts', {
        method: 'POST',
        json: { name, latitude: where.latitude, longitude: where.longitude, sport_ids: sportIds, description: description || null, photos },
      })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-8 text-center">
        <p className="text-6xl" aria-hidden>
          ⏳
        </p>
        <h1 className="display mt-3 text-5xl font-extrabold">Court submitted</h1>
        <p className="mt-2 text-ink-2">Status: PENDING. It appears on the map once an admin approves it.</p>
        <Button className="mt-8 w-full" onClick={() => navigate('/')}>
          Back to map
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
          <LocationPicker value={where} initial={center} onChange={setWhere} />
          {coords && !where && (
            <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => setWhere(coords)}>
              I'm at the court now
            </button>
          )}
        </Field>
        <Field label="Sports">
          <div className="flex flex-wrap gap-2">
            {sports?.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSport(s.id)}
                aria-pressed={sportIds.includes(s.id)}
                className={`rounded-xl border-2 px-3 py-2 font-semibold ${sportIds.includes(s.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Photos (optional)">
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <img key={p} src={p} alt="" className="size-20 rounded-xl object-cover" />
            ))}
            {photos.length < 6 && (
              <label className="flex size-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-ink-2">
                {uploading ? '…' : '＋'}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => addPhotos(e.target.files)} />
              </label>
            )}
          </div>
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
