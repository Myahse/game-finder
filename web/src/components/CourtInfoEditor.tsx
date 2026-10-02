import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { reverseGeocode } from '../lib/reverseGeocode'
import { parseOpeningHours } from '../lib/openingHours'
import { useAuth } from '../lib/auth'
import { useMySport } from '../lib/mySport'
import { qk, useSports } from '../lib/queries'
import type { CourtDetail } from '../lib/types'
import { SportName } from './icons'
import { Button, ErrorText, Field, Input, Textarea } from './ui'

type Props = {
  court: CourtDetail
  canEdit: boolean
}

type LightingChoice = 'unknown' | 'yes' | 'no'

export function CourtInfoEditor({ court, canEdit }: Props) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const mySport = useMySport()
  const { data: sports } = useSports()
  const sportLocked = user?.role !== 'admin' && !!mySport
  const parsed = parseOpeningHours(court.opening_hours)
  const [opens, setOpens] = useState(parsed?.opens ?? '')
  const [closes, setCloses] = useState(parsed?.closes ?? '')
  const [address, setAddress] = useState(court.address ?? '')
  const [surface, setSurface] = useState(court.surface ?? '')
  const [description, setDescription] = useState(court.description ?? '')
  const [lighting, setLighting] = useState<LightingChoice>(
    court.lighting === true ? 'yes' : court.lighting === false ? 'no' : 'unknown',
  )
  const [sportIds, setSportIds] = useState<string[]>(court.sports.map((s) => s.id))
  const [busy, setBusy] = useState(false)
  const [geocodingAddress, setGeocodingAddress] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = parseOpeningHours(court.opening_hours)
    setOpens(p?.opens ?? '')
    setCloses(p?.closes ?? '')
    setAddress(court.address ?? '')
    setSurface(court.surface ?? '')
    setDescription(court.description ?? '')
    setLighting(court.lighting === true ? 'yes' : court.lighting === false ? 'no' : 'unknown')
    setSportIds(court.sports.map((s) => s.id))
  }, [court])

  useEffect(() => {
    if (sportLocked && mySport) setSportIds([mySport.id])
  }, [sportLocked, mySport?.id])

  if (!canEdit) return null

  const toggleSport = (id: string) =>
    setSportIds((s) => (s.includes(id) ? (s.length > 1 ? s.filter((x) => x !== id) : s) : [...s, id]))

  const fillAddressFromMap = async () => {
    setGeocodingAddress(true)
    const addr = await reverseGeocode({ latitude: court.latitude, longitude: court.longitude })
    if (addr) setAddress(addr)
    setGeocodingAddress(false)
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await api<CourtDetail>(`/api/courts/${court.id}/info`, {
        method: 'PATCH',
        json: {
          opens_at: opens,
          closes_at: closes,
          address,
          surface,
          description,
          lighting: lighting === 'unknown' ? null : lighting === 'yes',
          sport_ids: sportIds,
        },
      })
      await qc.invalidateQueries({ queryKey: qk.court(court.id) })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="display text-lg font-bold">Court info</h3>
      <p className="mt-1 text-xs text-ink-2">Update details before approval. Shown to everyone once the court is live.</p>

      <div className="mt-4 grid gap-4">
        <Field label="Sport">
          {sportLocked && mySport ? (
            <p className="flex items-center gap-2 rounded-xl border border-brand bg-brand/10 px-3 py-2 text-sm font-semibold">
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
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${sportIds.includes(s.id) ? 'border-brand bg-brand/10' : 'border-line bg-surface-2'}`}
                >
                  <SportName sport={s} />
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Address" hint="Use the map pin on file — only admins can move the pin.">
          <Input placeholder="Street or place name" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-brand disabled:opacity-50"
            disabled={geocodingAddress}
            onClick={() => fillAddressFromMap()}
          >
            {geocodingAddress ? 'Looking up…' : 'Fill from map location'}
          </button>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens">
            <Input type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </Field>
          <Field label="Closes">
            <Input type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </Field>
        </div>
        <Field label="Surface">
          <Input placeholder="e.g. Concrete, grass, indoor" value={surface} onChange={(e) => setSurface(e.target.value)} />
        </Field>
        <Field label="Lighting">
          <select
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm"
            value={lighting}
            onChange={(e) => setLighting(e.target.value as LightingChoice)}
          >
            <option value="unknown">Not specified</option>
            <option value="yes">Lit at night</option>
            <option value="no">No lights</option>
          </select>
        </Field>
        <Field label="Description">
          <Textarea
            maxLength={1000}
            placeholder="Access, hoops, best times…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>

      <Button type="button" className="mt-4 w-full" loading={busy} onClick={save}>
        Save court info
      </Button>
      {error && (
        <p className="mt-2">
          <ErrorText>{error}</ErrorText>
        </p>
      )}
    </div>
  )
}
