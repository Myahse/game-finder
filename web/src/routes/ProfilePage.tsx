import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage, uploadImage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLocale } from '../i18n/LocaleProvider'
import type { SkillLevel } from '../lib/types'
import { useSports, useUpdateMe, useUser } from '../lib/queries'
import type { Me, PublicUser } from '../lib/types'
import { Star, Swords, TrendingUp } from 'lucide-react'
import { SportIcon, SportName, Wrench } from '../components/icons'
import { FriendsPanel } from '../components/FriendsPanel'
import { ProfileFriendActions } from '../components/ProfileFriendActions'
import { playerDisplayLabel, playerFullName, playerUsernameLabel } from '../lib/format'
import { hasPlayerAvatar, playerAvatarForUser } from '../avatar/resolve'
import { ShareProfileButton } from '../components/ShareProfileSheet'
import { StickerButton } from '../components/StickerSheet'
import { RecapButton } from '../components/RecapSheet'
import { MyProgressCard, UserProgressCard } from '../components/ProgressCard'
import { PlayerChallengeBlock } from '../components/PlayerChallengeBlock'
import { PasswordCard } from '../components/PasswordCard'
import { AvatarPortrait } from '../avatar/render/AvatarPortrait'
import { AVATAR_SPORTS, defaultConfig } from '../avatar/presets'
import { useMySport } from '../lib/mySport'
import { ScreenGuide } from '../components/ScreenGuide'
import { Avatar, Button, Card, ErrorText, Field, Input, PageHeader, Select } from '../components/ui'
import { Loading } from './CourtPage'

export function ProfileCard({ user, viewerIsAdmin = false }: { user: PublicUser; viewerIsAdmin?: boolean }) {
  const { t, locale } = useLocale()
  const { data: sports } = useSports()
  const sport = sports?.find((s) => s.id === user.preferred_sport_id)
  const skillLabels: Record<SkillLevel, string> = t.skill
  return (
    <Card className="text-center">
      <div className="flex justify-center">
        <Avatar user={user} size={96} />
      </div>
      {viewerIsAdmin && playerFullName(user) ? (
        <>
          <h2 className="display mt-3 text-4xl font-extrabold">{playerFullName(user)}</h2>
          <p className="text-ink-2">{playerUsernameLabel(user)}</p>
        </>
      ) : (
        <h2 className="display mt-3 text-4xl font-extrabold">{playerUsernameLabel(user)}</h2>
      )}
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
        <Stat value={user.stats?.games_played ?? 0} label={t.profile.gamesPlayed} />
        <Stat value={user.stats?.games_created ?? 0} label={t.profile.gamesCreated} />
      </div>
      <p className="mt-4 text-xs text-ink-2">
        {t.profile.joined}{' '}
        {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(user.created_at))}
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

/** Nudge for players who haven't made an avatar yet, previewing a player in their sport. */
function CreateAvatarCard() {
  const { t } = useLocale()
  const mySport = useMySport()
  const preview = defaultConfig(AVATAR_SPORTS.find((s) => s === mySport?.slug) ?? 'basketball')
  return (
    <Link to="/profile/avatar" className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-3 transition hover:bg-brand/15">
      <span className="size-16 shrink-0 overflow-hidden rounded-full bg-surface">
        <AvatarPortrait config={preview} className="h-full w-full" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block text-xl font-extrabold text-brand">{t.profile.createAvatar}</span>
        <span className="block text-sm text-ink-2">{t.profile.avatarPrompt}</span>
      </span>
    </Link>
  )
}

export function PlayerProfileView({
  profile,
  title,
  back = '/',
  viewerIsAdmin = false,
}: {
  profile: PublicUser | undefined
  title: string
  back?: string
  viewerIsAdmin?: boolean
}) {
  const { t } = useLocale()
  const { user: viewer } = useAuth()
  const signedIn = !!viewer
  const headerTitle =
    profile && viewerIsAdmin ? playerDisplayLabel(profile, true) : title
  return (
    <div className="pb-10">
      <PageHeader title={headerTitle} back={back} />
      <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-4 p-4">
        {profile ? (
          <>
            <ProfileCard user={profile} viewerIsAdmin={viewerIsAdmin} />
            <ProfileFriendActions user={profile} viewerIsAdmin={viewerIsAdmin} />
            {signedIn && viewer?.id !== profile.id && <PlayerChallengeBlock player={profile} />}
            {signedIn && <UserProgressCard userId={profile.id} avatar={playerAvatarForUser(profile)} />}
          </>
        ) : (
          <p>{t.common.playerNotFound}</p>
        )}
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { t } = useLocale()
  const { user, logout, updateUser } = useAuth()
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me') })
  const [editing, setEditing] = useState(false)
  if (!user) return null
  const current = me ?? user
  const viewerIsAdmin = user.role === 'admin'
  const canEditPlayerAvatar = hasPlayerAvatar(current)
  const playerAvatar = playerAvatarForUser(current)

  return (
    <div className="pb-10">
      <PageHeader
        title={t.profile.title}
        right={
          <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => setEditing((e) => !e)}>
            {editing ? t.common.close : t.common.edit}
          </Button>
        }
      />
      <div className="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-4 p-4">
        {editing ? (
          <EditProfile
            me={current}
            onSaved={(u) => {
              updateUser(u)
              setEditing(false)
            }}
          />
        ) : (
          <>
            <ProfileCard user={current} viewerIsAdmin={viewerIsAdmin} />
            {canEditPlayerAvatar ? (
              <Link
                to="/profile/avatar"
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-surface-2 px-5 text-lg font-bold text-ink"
              >
                {t.profile.editAvatar}
              </Link>
            ) : (
              <CreateAvatarCard />
            )}
            <div data-guide="progress">
              <MyProgressCard avatar={playerAvatar} />
            </div>
            <ScreenGuide
              screen="profile"
              tips={[
                { target: 'progress', icon: TrendingUp, title: t.guide.progressTitle, body: t.guide.progressBody },
                { target: 'my-challenges', icon: Swords, title: t.guide.duelTitle, body: t.guide.duelBody },
              ]}
            />
            <ShareProfileButton me={current} />
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0 [&>button]:whitespace-normal [&>button]:leading-tight">
              <Link
                to="/challenges"
                data-guide="my-challenges"
                className="display col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-brand-ink"
              >
                <Swords className="size-5" aria-hidden /> {t.challenge.myChallenges}
              </Link>
              <RecapButton me={current} />
              {playerAvatar && <StickerButton avatar={playerAvatar} />}
            </div>
            <FriendsPanel viewerIsAdmin={viewerIsAdmin} />
            <PasswordCard me={current} />
          </>
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-2 rounded-xl bg-surface p-4 font-semibold">
            <Wrench className="size-5 shrink-0" aria-hidden />
            {t.profile.adminDashboard}
          </Link>
        )}
        <Button variant="secondary" onClick={logout}>
          {t.common.logOut}
        </Button>
      </div>
    </div>
  )
}

function EditProfile({ me, onSaved }: { me: Me; onSaved: (u: Me) => void }) {
  const { t } = useLocale()
  const update = useUpdateMe()
  const skillLabels: Record<SkillLevel, string> = t.skill
  const { data: sports } = useSports()
  const sportLocked = me.role !== 'admin' && !!me.preferred_sport_id
  const lockedSport = sports?.find((s) => s.id === me.preferred_sport_id)
  const [form, setForm] = useState({
    first_name: me.first_name,
    last_name: me.last_name,
    username: me.username,
    preferred_sport_id: me.preferred_sport_id ?? '',
    extra_sport_ids: me.extra_sport_ids ?? [],
    skill_level: me.skill_level ?? 'all_levels',
    avatar_url: me.avatar_url ?? '',
  })

  const toggleExtraSport = (id: string) => {
    if (id === form.preferred_sport_id) return
    setForm((f) => {
      const has = f.extra_sport_ids.includes(id)
      if (has) return { ...f, extra_sport_ids: f.extra_sport_ids.filter((x) => x !== id) }
      if (f.extra_sport_ids.length >= 2) return f
      return { ...f, extra_sport_ids: [...f.extra_sport_ids, id] }
    })
  }
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
            extra_sport_ids: form.extra_sport_ids,
            ...(sportLocked ? {} : { preferred_sport_id: form.preferred_sport_id || undefined }),
          },
          { onSuccess: onSaved, onError: (err) => setError(errorMessage(err)) },
        )
      }}
    >
      <label className="flex cursor-pointer items-center gap-4">
        <Avatar user={{ ...me, avatar_url: form.avatar_url || null }} size={72} />
        <span className="font-semibold text-brand">{uploading ? t.common.uploading : t.common.changePhoto}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.profile.firstName}>
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
        </Field>
        <Field label={t.profile.lastName}>
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
        </Field>
      </div>
      <Field label={t.profile.username}>
        <Input value={form.username} pattern="[A-Za-z0-9_.]{3,24}" onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      </Field>
      <Field label={t.profile.sport} hint={sportLocked ? t.profile.sportLockedHint : undefined}>
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
      {sportLocked && sports && (sports.filter((s) => s.active).length ?? 0) > 1 && (
        <Field label={t.profile.extraSports} hint={t.profile.extraSportsHint}>
          <div className="flex flex-wrap gap-2">
            {sports
              ?.filter((s) => s.active && s.id !== form.preferred_sport_id)
              .map((s) => {
                const on = form.extra_sport_ids.includes(s.id)
                const disabled = !on && form.extra_sport_ids.length >= 2
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleExtraSport(s.id)}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
                      on ? 'border-brand bg-brand/10' : disabled ? 'border-line opacity-40' : 'border-line bg-surface'
                    }`}
                  >
                    <SportIcon slug={s.slug} className="size-4 text-brand" />
                    {s.name}
                  </button>
                )
              })}
          </div>
        </Field>
      )}
      <Field label={t.profile.skillLevel}>
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
        {t.common.save}
      </Button>
    </form>
  )
}

export function UserPage() {
  const { t } = useLocale()
  const { user: me } = useAuth()
  const { id } = useParams()
  const { data: user, isLoading } = useUser(id!)
  const viewerIsAdmin = me?.role === 'admin'
  if (isLoading) return <Loading />
  const title = user ? playerUsernameLabel(user) : t.common.player
  return <PlayerProfileView profile={user} title={title} back="/" viewerIsAdmin={viewerIsAdmin} />
}
