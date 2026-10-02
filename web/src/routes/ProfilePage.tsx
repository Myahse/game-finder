import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { skillLabels } from '../lib/format'
import { useSports, useUpdateMe, useUser } from '../lib/queries'
import type { Me, PublicUser, SkillLevel } from '../lib/types'
import { Star } from 'lucide-react'
import { SportName, Wrench } from '../components/icons'
import { Avatar, Button, Card, ErrorText, Field, Input, PageHeader, Select } from '../components/ui'
import { Loading } from './CourtPage'

function ProfileCard({ user }: { user: PublicUser }) {
  const { data: sports } = useSports()
  const sport = sports?.find((s) => s.id === user.preferred_sport_id)
  return (
    <Card className="text-center">
      <div className="flex justify-center">
        <Avatar user={user} size={96} />
      </div>
      <h2 className="display mt-3 text-4xl font-extrabold">
        {user.first_name} {user.last_name}
      </h2>
      <p className="text-ink-2">@{user.username}</p>
      <p className="mt-3 flex justify-center gap-4 font-semibold">
        {sport && <SportName sport={sport} />}
        {user.skill_level && (
          <span className="inline-flex items-center gap-1">
            <Star className="size-4 shrink-0" aria-hidden />
            {skillLabels[user.skill_level]}
          </span>
        )}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Stat value={user.stats?.games_played ?? 0} label="games played" />
        <Stat value={user.stats?.games_created ?? 0} label="games created" />
      </div>
      <p className="mt-4 text-xs text-ink-2">
        Joined {new Date(user.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })}
      </p>
    </Card>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="display text-4xl font-extrabold text-brand">{value}</p>
      <p className="text-xs font-semibold uppercase text-ink-2">{label}</p>
    </div>
  )
}

export function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me') })
  const [editing, setEditing] = useState(false)
  if (!user) return null
  const current = me ?? user

  return (
    <div className="pb-10">
      <PageHeader
        title="Profile"
        right={
          <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
        }
      />
      <div className="mx-auto grid max-w-md gap-4 p-4">
        {editing ? (
          <EditProfile
            me={current}
            onSaved={(u) => {
              updateUser(u)
              setEditing(false)
            }}
          />
        ) : (
          <ProfileCard user={current} />
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-2 rounded-xl bg-surface p-4 font-semibold">
            <Wrench className="size-5 shrink-0" aria-hidden />
            Admin dashboard
          </Link>
        )}
        <Button variant="secondary" onClick={logout}>
          Log out
        </Button>
      </div>
    </div>
  )
}

function EditProfile({ me, onSaved }: { me: Me; onSaved: (u: Me) => void }) {
  const update = useUpdateMe()
  const { data: sports } = useSports()
  const sportLocked = me.role !== 'admin' && !!me.preferred_sport_id
  const lockedSport = sports?.find((s) => s.id === me.preferred_sport_id)
  const [form, setForm] = useState({
    first_name: me.first_name,
    last_name: me.last_name,
    username: me.username,
    preferred_sport_id: me.preferred_sport_id ?? '',
    skill_level: me.skill_level ?? 'all_levels',
    avatar_url: me.avatar_url ?? '',
  })
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const onPhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      setForm((f) => ({ ...f, avatar_url: '' }))
      const url = await uploadImage(file, 'avatar')
      setForm((f) => ({ ...f, avatar_url: url }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        update.mutate(
          {
            ...form,
            skill_level: form.skill_level as SkillLevel,
            ...(sportLocked ? {} : { preferred_sport_id: form.preferred_sport_id || undefined }),
          },
          { onSuccess: onSaved, onError: (err) => setError(errorMessage(err)) },
        )
      }}
    >
      <label className="flex cursor-pointer items-center gap-4">
        <Avatar user={{ ...me, avatar_url: form.avatar_url || null }} size={72} />
        <span className="font-semibold text-brand">{uploading ? 'Uploading…' : 'Change photo'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
        </Field>
        <Field label="Last name">
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
        </Field>
      </div>
      <Field label="Username">
        <Input value={form.username} pattern="[A-Za-z0-9_.]{3,24}" onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      </Field>
      <Field label="Sport" hint={sportLocked ? 'Set at signup and locked to keep the map focused.' : undefined}>
        {sportLocked && lockedSport ? (
          <p className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-semibold">{lockedSport.name}</p>
        ) : (
          <Select value={form.preferred_sport_id} onChange={(e) => setForm({ ...form, preferred_sport_id: e.target.value })}>
            {sports
              ?.filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Skill level">
        <Select value={form.skill_level} onChange={(e) => setForm({ ...form, skill_level: e.target.value as SkillLevel })}>
          {(Object.keys(skillLabels) as SkillLevel[]).map((k) => (
            <option key={k} value={k}>
              {skillLabels[k]}
            </option>
          ))}
        </Select>
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" loading={update.isPending} disabled={uploading}>
        Save
      </Button>
    </form>
  )
}

export function UserPage() {
  const { id } = useParams()
  const { data: user, isLoading } = useUser(id!)
  if (isLoading) return <Loading />
  return (
    <div className="pb-10">
      <PageHeader title="Player" back="/" />
      <div className="mx-auto max-w-md p-4">{user ? <ProfileCard user={user} /> : <p>Player not found.</p>}</div>
    </div>
  )
}
