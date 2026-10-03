import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { playerDisplayLabel } from '../../lib/format'
import { DEFAULT_CENTER, type Coords } from '../../lib/location'
import { useSports } from '../../lib/queries'
import type { Court, PublicUser } from '../../lib/types'
import { Plus, SportIcon, SportName } from '../../components/icons'
import { LocationPicker } from '../../components/LocationPicker'
import { Button, Card, Chip, ErrorText, Field, Input, Textarea } from '../../components/ui'
import { Loading } from '../CourtPage'

type AdminCourt = Court & { creator: PublicUser | null; open_reports: number }

export function AdminCourts() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AdminCourt | 'new' | null>(null)
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'courts', status, q],
    queryFn: () => api<AdminCourt[]>(`/api/admin/courts?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}`),
  })
  const act = useMutation({
    mutationFn: ({
      id,
      kind,
      reason,
    }: {
      id: string
      kind: 'approve' | 'reject' | 'pending' | 'delete'
      reason?: string
    }) =>
      kind === 'delete'
        ? api(`/api/admin/courts/${id}`, { method: 'DELETE' })
        : kind === 'pending'
          ? api(`/api/admin/courts/${id}/review`, { method: 'POST', json: { pending: true } })
          : api(`/api/admin/courts/${id}/review`, { method: 'POST', json: { approve: kind === 'approve', reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => alert(errorMessage(e)),
  })

  const editId = params.get('edit')
  useEffect(() => {
    if (!editId || !data) return
    const c = data.find((x) => x.id === editId)
    if (c) setEditing(c)
  }, [editId, data])

  if (editing) return <CourtEditor court={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {[null, 'pending', 'approved', 'rejected'].map((s) => (
          <Chip key={s ?? 'all'} active={status === s} onClick={() => setParams(s ? { status: s } : {})}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </Chip>
        ))}
        <Input className="max-w-56 py-2" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button className="ml-auto min-h-10" onClick={() => setEditing('new')}>
          <span className="inline-flex items-center gap-2">
            <Plus className="size-4" aria-hidden />
            Add court
          </span>
        </Button>
      </div>
      {isLoading && <Loading />}
      {data?.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-start gap-3">
          {c.photos[0] && <img src={c.photos[0]} alt="" className="size-16 rounded-xl object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {c.name}{' '}
              <span
                className={`ml-1 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${
                  c.status === 'approved' ? 'bg-live/15 text-live' : c.status === 'pending' ? 'bg-players/25' : 'bg-danger/15 text-danger'
                }`}
              >
                {c.status}
              </span>
              {c.open_reports > 0 && <span className="ml-2 text-xs font-semibold text-danger">⚑ {c.open_reports} reports</span>}
            </p>
            <p className="text-sm text-ink-2">
              <span className="inline-flex items-center gap-1">
                {c.sports.map((s) => <SportIcon key={s.id} slug={s.slug} className="size-4" />)}
              </span>
              {c.address ?? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`}
            </p>
            {c.creator && (
              <p className="text-xs text-ink-2">
                Proposed by {playerDisplayLabel(c.creator, true)}
              </p>
            )}
            {c.description && <p className="mt-1 text-sm">{c.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/courts/${c.id}`}>
              <Button type="button" variant="secondary" className="min-h-9 px-3 text-base">
                Review
              </Button>
            </Link>
            {c.status === 'approved' && (
              <Button
                variant="ghost"
                className="min-h-9 px-3 text-base"
                onClick={() => {
                  if (confirm(`Send "${c.name}" back to pending review? It will be hidden from the public map.`))
                    act.mutate({ id: c.id, kind: 'pending' })
                }}
              >
                Unapprove
              </Button>
            )}
            <Button variant="secondary" className="min-h-9 px-3 text-base" onClick={() => setEditing(c)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              className="min-h-9 px-3 text-base"
              onClick={() => confirm(`Delete ${c.name}? Its games are deleted too.`) && act.mutate({ id: c.id, kind: 'delete' })}
            >
              Delete
            </Button>
          </div>
        </Card>
      ))}
      {data?.length === 0 && <p className="p-6 text-center text-ink-2">No courts.</p>}
    </div>
  )
}

function CourtEditor({ court, onDone }: { court: AdminCourt | null; onDone: () => void }) {
  const qc = useQueryClient()
  const { data: sports } = useSports()
  const [form, setForm] = useState({
    name: court?.name ?? '',
    address: court?.address ?? '',
    description: court?.description ?? '',
    opening_hours: court?.opening_hours ?? '',
    surface: court?.surface ?? '',
    lighting: court?.lighting ?? false,
    photos: court?.photos ?? [],
    sport_ids: court?.sports.map((s) => s.id) ?? [],
  })
  const [where, setWhere] = useState<Coords | null>(court ? { latitude: court.latitude, longitude: court.longitude } : null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!where) return setError('Place the court on the map.')
    setBusy(true)
    try {
      const body = {
        ...form,
        address: form.address || null,
        description: form.description || null,
        opening_hours: form.opening_hours || null,
        surface: form.surface || null,
        latitude: where.latitude,
        longitude: where.longitude,
      }
      await api(court ? `/api/admin/courts/${court.id}` : '/api/admin/courts', { method: court ? 'PATCH' : 'POST', json: body })
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['courts'] })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-xl gap-4">
      <h2 className="display text-3xl font-bold">{court ? `Edit ${court.name}` : 'New court'}</h2>
      <Field label="Name">
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Location">
        <LocationPicker value={where} initial={where ?? DEFAULT_CENTER} onChange={setWhere} />
      </Field>
      <Field label="Sports">
        <div className="flex flex-wrap gap-2">
          {sports?.map((s) => (
            <Chip
              key={s.id}
              active={form.sport_ids.includes(s.id)}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  sport_ids: f.sport_ids.includes(s.id) ? f.sport_ids.filter((x) => x !== s.id) : [...f.sport_ids, s.id],
                }))
              }
            >
              <SportName sport={s} />
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Address">
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opening hours">
          <Input value={form.opening_hours} placeholder="06:00–22:00" onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} />
        </Field>
        <Field label="Surface">
          <Input value={form.surface} placeholder="Concrete" onChange={(e) => setForm({ ...form, surface: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={form.lighting} onChange={(e) => setForm({ ...form, lighting: e.target.checked })} className="size-5 accent-[var(--brand)]" />
        Lit at night
      </label>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!form.sport_ids.length}>
          Save
        </Button>
      </div>
    </form>
  )
}
