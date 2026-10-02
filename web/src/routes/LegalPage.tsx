import { Link } from 'react-router-dom'
import { LEGAL_LAST_UPDATED, privacySections, termsSections } from '../content/legal'
import { PageHeader } from '../components/ui'

function LegalDoc({ title, sections }: { title: string; sections: { title: string; body: string }[] }) {
  return (
    <div className="pb-12">
      <PageHeader title={title} back="/welcome" />
      <article className="mx-auto max-w-lg space-y-6 p-5 text-sm leading-relaxed text-ink-2">
        <p className="text-xs text-ink-2">Last updated: {LEGAL_LAST_UPDATED}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="display text-lg font-bold text-ink">{s.title}</h2>
            <p className="mt-2">{s.body}</p>
          </section>
        ))}
        <p className="border-t border-line pt-4 text-xs">
          This is a community product template. Have a lawyer review before a large public launch.
        </p>
      </article>
    </div>
  )
}

export function TermsPage() {
  return <LegalDoc title="Terms of use" sections={termsSections} />
}

export function PrivacyPage() {
  return <LegalDoc title="Privacy policy" sections={privacySections} />
}

export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-ink-2 ${className}`}>
      <Link to="/terms" className="font-semibold text-brand hover:underline">Terms</Link>
      {' · '}
      <Link to="/privacy" className="font-semibold text-brand hover:underline">Privacy</Link>
    </p>
  )
}
