import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { skillLabels } from '../lib/format'
import { useSports, useUpdateMe } from '../lib/queries'
import type { SkillLevel } from '../lib/types'
import { SportIcon, SportName } from '../components/icons'
import { StepFlow, useStepFlow } from '../components/StepFlow'
import { ErrorText, Field, Input, Spinner } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

const usernamePattern = /^[A-Za-z0-9_.]{3,24}$/

function profileCompleteFromUser(user: { first_name?: string; last_name?: string; username?: string } | null) {
  if (!user) return false
  const u = user.username?.trim() ?? ''
  return (
    (user.first_name?.trim().length ?? 0) > 0 &&
    (user.last_name?.trim().length ?? 0) > 0 &&
    usernamePattern.test(u)
  )
}

export function OnboardingPage() {
  const { user, updateUser, logout } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const { data: sports } = useSports()
  const update = useUpdateMe()
  const startStep = useMemo(() => (profileCompleteFromUser(user) ? 1 : 0), [user])
  const { step, setStep } = useStepFlow(startStep)
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

  const goNext = async () => {
    setError('')
    if (step === 0) {
      await checkUsername()
      if (usernameTaken) return
    }
    setStep(step + 1)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
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
        onError: (err) => setError(errorMessage(err)),
      },
    )
  }

  const canNext = step === 0 ? profileValid : step === 1 ? !!sportId : profileValid && !!sportId

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 py-10">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="text-sm font-semibold text-ink-2 hover:text-brand"
          onClick={() => void logout().then(() => navigate('/', { replace: true }))}
        >
          Sign out
        </button>
      </div>
      <p className="text-sm font-semibold text-ink-2">{t.onboarding.welcome}, {user?.first_name}</p>
      <h1 className="display mt-1 text-4xl font-extrabold">{t.onboarding.title}</h1>
      <p className="mt-3 text-ink-2">{t.onboarding.subtitle}</p>

      <div className="mt-8">
        <StepFlow
          step={step}
          onStepChange={setStep}
          onStepAdvance={goNext}
          onSubmit={submit}
          canNext={canNext}
          busy={update.isPending}
          submitLabel={t.onboarding.openMap}
        >
          {[
            <div key="profile" className="grid gap-3">
              <h2 className="display text-2xl font-bold">{t.onboarding.profile}</h2>
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
            </div>,
            <div key="sport" className="grid gap-3">
              <h2 className="display text-2xl font-bold">{t.onboarding.sport}</h2>
              <p className="text-sm text-ink-2">{t.onboarding.sportHint}</p>
              {!sports && <Spinner />}
              {available.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSportId(s.id)}
                  aria-pressed={sportId === s.id}
                  className={`flex items-center gap-4 rounded-2xl border-2 p-3 text-left transition ${
                    sportId === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'
                  }`}
                >
                  <SportIcon slug={s.slug} className="size-9 text-brand" />
                  <span className="display text-xl font-bold">{s.name}</span>
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
            </div>,
            <div key="skill" className="grid gap-3">
              <h2 className="display text-2xl font-bold">{t.profile.skillLevel}</h2>
              <p className="text-sm text-ink-2">Games and matchmaking use this as a guide for who joins.</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(skillLabels) as SkillLevel[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSkill(k)}
                    aria-pressed={skill === k}
                    className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold ${skill === k ? 'border-brand bg-brand/10' : 'border-line bg-surface'}`}
                  >
                    {skillLabels[k]}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-ink-2">{t.onboarding.locationHint}</p>
            </div>,
          ]}
        </StepFlow>
        {error ? <div className="mt-3"><ErrorText>{error}</ErrorText></div> : null}
      </div>
    </div>
  )
}
