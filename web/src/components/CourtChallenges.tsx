import { useLocale } from '../i18n/LocaleProvider'
import { useOpenChallenges } from '../lib/challenges'
import { ChallengeCard } from './ChallengeCard'
import { ChallengeButton } from './ChallengeComposer'

/** Open challenges at a court + a button to post one. */
export function CourtChallenges({ court }: { court: { id: string; name: string } }) {
  const { t } = useLocale()
  const { data } = useOpenChallenges(court.id)
  return (
    <section className="grid gap-2">
      {data && data.length > 0 && <h2 className="display text-2xl font-bold">{t.challenge.openHere}</h2>}
      {data?.map((c) => (
        <ChallengeCard key={c.id} c={c} />
      ))}
      <ChallengeButton court={court} label={t.challenge.postOpen} className="w-full" />
    </section>
  )
}
