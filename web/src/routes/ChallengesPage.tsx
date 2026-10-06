import { Link, useParams } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { ChallengeCard } from '../components/ChallengeCard'
import { Empty, PageHeader, Spinner } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { useChallenge, useChallenges, type Challenge } from '../lib/challenges'

function Section({ title, items }: { title: string; items: Challenge[] }) {
  if (items.length === 0) return null
  return (
    <section className="grid gap-2">
      <h2 className="display text-2xl font-bold">{title}</h2>
      {items.map((c) => (
        <ChallengeCard key={c.id} c={c} />
      ))}
    </section>
  )
}

/** Incoming, live, outgoing and past challenges, plus my W–L record. */
export function ChallengesPage() {
  const { t } = useLocale()
  const { data, isLoading } = useChallenges()
  const empty = data && !data.incoming.length && !data.active.length && !data.outgoing.length && !data.history.length
  return (
    <div className="pb-10">
      <PageHeader
        title={t.challenge.title}
        back="/profile"
        right={
          data && (data.record.wins > 0 || data.record.losses > 0) ? (
            <span className="display rounded-lg bg-surface-2 px-2.5 py-1 text-lg font-bold">
              {t.challenge.record.replace('{w}', String(data.record.wins)).replace('{l}', String(data.record.losses))}
            </span>
          ) : null
        }
      />
      <div className="mx-auto grid max-w-md gap-5 p-4">
        {isLoading && <Spinner className="mx-auto text-brand" />}
        {empty && (
          <Empty icon={<Swords className="size-14" strokeWidth={1.5} />} title={t.challenge.title}>
            {t.challenge.empty}
          </Empty>
        )}
        {data && (
          <>
            <Section title={t.challenge.incoming} items={data.incoming} />
            <Section title={t.challenge.active} items={data.active} />
            <Section title={t.challenge.outgoing} items={data.outgoing} />
            <Section title={t.challenge.history} items={data.history} />
          </>
        )}
      </div>
    </div>
  )
}

/** One challenge card — where shared challenge links land. */
export function ChallengeDetailPage() {
  const { t } = useLocale()
  const { id } = useParams()
  const { data, isLoading, isError } = useChallenge(id)
  return (
    <div className="pb-10">
      <PageHeader title={t.challenge.title} back="/challenges" />
      <div className="mx-auto grid max-w-md gap-4 p-4">
        {isLoading && <Spinner className="mx-auto text-brand" />}
        {isError && (
          <Empty icon={<Swords className="size-14" strokeWidth={1.5} />} title={t.challenge.title}>
            {t.challenge.notFound}
          </Empty>
        )}
        {data && <ChallengeCard c={data} />}
        <Link to="/challenges" className="text-center text-sm font-semibold text-ink-2 hover:text-ink">
          {t.challenge.seeAll}
        </Link>
      </div>
    </div>
  )
}
