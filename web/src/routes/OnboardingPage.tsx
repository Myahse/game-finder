import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { skillLabels } from '../lib/format'
import { useSports, useUpdateMe } from '../lib/queries'
import type { SkillLevel } from '../lib/types'
import { SportIcon, SportName } from '../components/icons'
import { Button, ErrorText, Spinner } from '../components/ui'

export function OnboardingPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const { data: sports } = useSports()
  const update = useUpdateMe()
  const [sportId, setSportId] = useState<string | null>(user?.preferred_sport_id ?? null)
  const [skill, setSkill] = useState<SkillLevel>(user?.skill_level ?? 'intermediate')
  const [error, setError] = useState('')
  const available = sports?.filter((s) => s.active) ?? []
  const chosen = sportId ?? available[0]?.id ?? null

  const done = () =>
    update.mutate(
      { preferred_sport_id: chosen ?? undefined, skill_level: skill, onboarded: true },
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
      <p className="text-sm font-semibold text-ink-2">Welcome, {user?.first_name}</p>
      <h1 className="display mt-1 text-5xl font-extrabold">Set up your court radar</h1>
      <p className="mt-3 text-ink-2">
        Pick your main sport and how you usually play. We use this to sort games on the map — change anytime in Profile.
      </p>

      <div className="mt-6 grid gap-3">
        {!sports && <Spinner />}
        {available.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSportId(s.id)}
            aria-pressed={chosen === s.id}
            className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
              chosen === s.id ? 'border-brand bg-brand/10' : 'border-line bg-surface'
            }`}
          >
            <SportIcon slug={s.slug} className="size-10 text-brand" />
            <span className="display text-3xl font-bold">{s.name}</span>
          </button>
        ))}
        {sports?.some((s) => !s.active) && (
          <p className="text-sm text-ink-2">
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              Coming soon:
              {sports
                .filter((s) => !s.active)
                .map((s) => <SportName key={s.id} sport={s} />)}
            </span>
          </p>
        )}
      </div>

      <h2 className="display mt-10 text-3xl font-bold">Your level</h2>
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
        <Button onClick={done} loading={update.isPending} disabled={!chosen}>
          Open the map
        </Button>
        <p className="text-center text-xs text-ink-2">Turn on location on the map for distances and nearby alerts.</p>
      </div>
    </div>
  )
}
