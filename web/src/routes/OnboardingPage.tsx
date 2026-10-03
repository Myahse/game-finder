import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { skillLabels } from '../lib/format'
import { useSports, useUpdateMe } from '../lib/queries'
import type { SkillLevel } from '../lib/types'
import { SportIcon, SportName } from '../components/icons'
import { Button, ErrorText, Field, Input, Spinner } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

const usernamePattern = /^[A-Za-z0-9_.]{3,24}$/

export function OnboardingPage() {
  const { user, updateUser } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const { data: sports } = useSports()
  const update = useUpdateMe()
  const [sportId, setSportId] = useState<string | null>(user?.preferred_sport_id ?? null)
  const [skill, setSkill] = useState<SkillLevel>(user?.skill_level ?? 'intermediate')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [error, setError] = useState('')
  const available = sports?.filter((s) => s.active) ?? []

  const checkUsername = useCallback(async () => {
    const u = username.trim()
    if (!usernamePattern.test(u)) return
    if (u === user?.username) {
      setUsernameTaken(false)
      return
    }
    const r = await api<{ available: boolean }>(`/api/auth/username-available?username=${encodeURIComponent(u)}`).catch(() => null)
    setUsernameTaken(r ? !r.available : false)
  }, [username, user?.username])

  const profileValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    usernamePattern.test(username.trim()) &&
    !usernameTaken

  const done = () =>
    update.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        preferred_sport_id: sportId ?? undefined,
        skill_level: skill,
        onboarded: true,
      },
      {
        onSuccess: (me) => {
          updateUser(me)
          navigate('/', { replace: true })
        },
        onError: (e) => setError(errorMessage(e)),
      },
    )

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 py-10">
      <p className="text-sm font-semibold text-ink-2">{t.onboarding.welcome}, {user?.first_name}</p>
      <h1 className="display mt-1 text-5xl font-extrabold">{t.onboarding.title}</h1>
      <p className="mt-3 text-ink-2">{t.onboarding.subtitle}</p>

      <h2 className="display mt-8 text-2xl font-bold">{t.onboarding.profile}</h2>
      <div className="mt-3 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.profile.firstName}>
            <Input required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label={t.profile.lastName}>
            <Input required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field
          label={t.profile.username}
          hint={
            usernameTaken ? (
              <span className="text-danger">{t.onboarding.usernameTaken}</span>
            ) : (
              t.onboarding.usernameHint
            )
          }
        >
          <Input
            required
            pattern="[A-Za-z0-9_.]{3,24}"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsernameTaken(false)
              setUsername(e.target.value)
            }}
            onBlur={() => void checkUsername()}
          />
        </Field>
        {user?.email && (
          <p className="text-sm text-ink-2">
            {t.onboarding.email}: <span className="font-medium text-ink">{user.email}</span>
          </p>
        )}
      </div>

      <h2 className="display mt-10 text-3xl font-bold">{t.onboarding.sport}</h2>
      <p className="mt-2 text-sm text-ink-2">{t.onboarding.sportHint}</p>

      <div className="mt-4 grid gap-3">
        {!sports && <Spinner />}
        {available.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSportId(s.id)}
            aria-pressed={sportId === s.id}
            className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
              sportId === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'
            }`}
          >
            <SportIcon slug={s.slug} className="size-10 text-brand" />
            <span className="display text-3xl font-bold">{s.name}</span>
          </button>
        ))}
        {sports?.some((s) => !s.active) && (
          <p className="text-sm text-ink-2">
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              {t.onboarding.comingSoon}
              {sports
                .filter((s) => !s.active)
                .map((s) => <SportName key={s.id} sport={s} />)}
            </span>
          </p>
        )}
      </div>

      <h2 className="display mt-10 text-3xl font-bold">{t.profile.skillLevel}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(skillLabels) as SkillLevel[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSkill(k)}
            aria-pressed={skill === k}
            className={`rounded-xl border-2 px-3 py-3 font-semibold ${skill === k ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
          >
            {skillLabels[k]}
          </button>
        ))}
      </div>

      <div className="mt-auto grid gap-2 pt-10">
        <ErrorText>{error}</ErrorText>
        <Button onClick={done} loading={update.isPending} disabled={!sportId || !profileValid}>
          {t.onboarding.openMap}
        </Button>
        <p className="text-center text-xs text-ink-2">{t.onboarding.locationHint}</p>
      </div>
    </div>
  )
}
