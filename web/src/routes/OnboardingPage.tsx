import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { acceptPendingFriendInvite } from '../lib/friendInvite'
import { useAuth } from '../lib/auth'
import { playerSkillLevels } from '../lib/format'
import { useSports, useUpdateMe } from '../lib/queries'
import type { Me, SkillLevel } from '../lib/types'
import { BaseSportIcon, SportIcon, SportName } from '../components/icons'
import { SportCarousel, SportCarouselSkeleton } from '../components/SportCarousel'
import { SportCourt } from '../components/SportCourt'
import { StepIndicator } from '../components/StepIndicator'
import { useStepFlow } from '../components/StepFlow'
import { Button, ErrorText, Field, Input } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { useSportThemePreview } from '../theme/SportThemeProvider'

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

type OnboardingStep = 'sport' | 'profile' | 'level'

function initialPlayerSkill(user: Me | null): SkillLevel | null {
  const s = user?.skill_level
  if (s && s !== 'all_levels') return s
  return null
}

export function OnboardingPage() {
  const { user, updateUser, logout } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const { data: sports } = useSports()
  const update = useUpdateMe()
  const needsProfile = useMemo(() => !profileCompleteFromUser(user), [user])
  // Base sport comes first: it dresses every screen that follows.
  const steps: OnboardingStep[] = needsProfile ? ['sport', 'profile', 'level'] : ['sport', 'level']
  const lastStep = steps.length - 1
  const { step, setStep } = useStepFlow(0)
  const current = steps[Math.min(step, lastStep)]
  const [sportId, setSportId] = useState<string | null>(user?.preferred_sport_id ?? null)
  const [extraSportIds, setExtraSportIds] = useState<string[]>(user?.extra_sport_ids ?? [])
  const [skill, setSkill] = useState<SkillLevel | null>(() => initialPlayerSkill(user))
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [error, setError] = useState('')
  const available = sports?.filter((s) => s.active) ?? []
  const baseSport = available.find((s) => s.id === sportId) ?? null
  // Re-skin the app live as soon as a base sport is picked.
  useSportThemePreview(baseSport?.slug ?? null)

  /** Resolves `true` when the username is already taken. */
  const checkUsername = useCallback(async () => {
    const u = username.trim()
    if (!usernamePattern.test(u)) return false
    if (u === user?.username) {
      setUsernameTaken(false)
      return false
    }
    const r = await api<{ available: boolean }>(`/api/auth/username-available?username=${encodeURIComponent(u)}`).catch(() => null)
    const taken = r ? !r.available : false
    setUsernameTaken(taken)
    return taken
  }, [username, user?.username])

  const profileValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    usernamePattern.test(username.trim()) &&
    !usernameTaken

  const goNext = async () => {
    setError('')
    if (current === 'profile' && (await checkUsername())) return
    setStep(step + 1)
  }

  const chooseBase = (id: string) => {
    setSportId(id)
    setExtraSportIds((prev) => prev.filter((x) => x !== id))
  }

  const toggleExtraSport = (id: string) => {
    if (id === sportId) return
    setExtraSportIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!sportId || !skill) return
    update.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: username.trim(),
        preferred_sport_id: sportId,
        extra_sport_ids: extraSportIds,
        skill_level: skill,
        onboarded: true,
      },
      {
        onSuccess: async (me) => {
          updateUser(me)
          await acceptPendingFriendInvite()
          navigate('/', { replace: true })
        },
        onError: (err) => setError(errorMessage(err)),
      },
    )
  }

  const canNext =
    current === 'sport' ? !!sportId : current === 'profile' ? profileValid : !!sportId && skill !== null

  const skillLabels = t.skill

  return (
    <div className="min-h-full">
      <div className="mx-auto flex max-w-md flex-col px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mb-8 flex items-center justify-between">
          <span className="display inline-flex items-center gap-1.5 text-xl font-extrabold">
            <BaseSportIcon className="sport-tint size-5 text-brand" />
            Find the <span className="sport-tint text-brand">Game</span>
          </span>
          <button
            type="button"
            className="text-sm font-semibold text-ink-2 hover:text-brand"
            onClick={() => void logout().then(() => navigate('/', { replace: true }))}
          >
            Sign out
          </button>
        </div>

        <p className="text-sm font-semibold text-ink-2">
          {t.onboarding.welcome}
          {user?.username ? `, @${user.username}` : ''}
        </p>
        <h1 className="display mt-1 text-4xl font-extrabold">{t.onboarding.title}</h1>
        <p className="mt-3 text-ink-2">{t.onboarding.subtitle}</p>

        <form onSubmit={submit} className="mt-7 grid grid-cols-1 gap-5">
          <StepIndicator current={step + 1} total={steps.length} />

          {current === 'sport' && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <h2 className="display text-2xl font-bold">{t.onboarding.sport}</h2>
                <p className="mt-1 text-sm text-ink-2">{t.onboarding.sportHint}</p>
              </div>
              {!sports ? (
                <SportCarouselSkeleton />
              ) : (
                <SportCarousel sports={available} selectedId={sportId} onSelect={(s) => chooseBase(s.id)} />
              )}
              {sports?.some((s) => !s.active) && (
                <p className="text-center text-sm text-ink-2">
                  <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    {t.onboarding.comingSoon}
                    {sports
                      .filter((s) => !s.active)
                      .map((s) => <SportName key={s.id} sport={s} />)}
                  </span>
                </p>
              )}
            </div>
          )}

          {current === 'profile' && (
            <div className="grid gap-3">
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
            </div>
          )}

          {current === 'level' && (
            <div className="grid grid-cols-1 gap-4">
              {baseSport && (
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-4">
                  <SportCourt slug={baseSport.slug} className="block h-12 w-[5.5rem] shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-ink-2">{t.onboarding.isBase}</span>
                    <span className="display block truncate text-2xl font-extrabold">{baseSport.name}</span>
                  </span>
                  <button type="button" onClick={() => setStep(0)} className="text-sm font-semibold text-brand hover:underline">
                    {t.onboarding.changeBase}
                  </button>
                </div>
              )}

              {sportId && available.length > 1 && (
                <div className="grid gap-2">
                  <p className="text-sm font-semibold text-ink">{t.onboarding.extraSports}</p>
                  <p className="text-xs text-ink-2">{t.onboarding.extraSportsHint}</p>
                  <div className="flex flex-wrap gap-2">
                    {available
                      .filter((s) => s.id !== sportId)
                      .map((s) => {
                        const on = extraSportIds.includes(s.id)
                        const disabled = !on && extraSportIds.length >= 2
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleExtraSport(s.id)}
                            aria-pressed={on}
                            className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${
                              on ? 'border-brand bg-brand/10' : disabled ? 'border-line opacity-40' : 'border-line bg-surface'
                            }`}
                          >
                            <SportIcon slug={s.slug} className="size-4 text-brand" />
                            {s.name}
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}

              <div className="grid gap-3 border-t border-line pt-4">
                <h2 className="display text-2xl font-bold">{t.profile.skillLevel}</h2>
                <p className="text-sm text-ink-2">{t.onboarding.levelHint}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {playerSkillLevels.map((k) => (
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
              </div>
            </div>
          )}

          {error ? <ErrorText>{error}</ErrorText> : null}

          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 flex-1 text-base"
                onClick={() => setStep(step - 1)}
                disabled={update.isPending}
              >
                Back
              </Button>
            ) : (
              <span className="flex-1" />
            )}
            {step < lastStep ? (
              <Button
                type="button"
                className="min-h-11 flex-1 text-base"
                disabled={!canNext || update.isPending}
                onClick={() => void goNext()}
              >
                Next
              </Button>
            ) : (
              <Button type="submit" className="min-h-11 flex-1 text-base" loading={update.isPending} disabled={!canNext || update.isPending}>
                {t.onboarding.openMap}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
