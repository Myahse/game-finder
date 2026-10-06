import { Link } from 'react-router-dom'
import type { LegalSection } from '../content/legal'
import { PageHeader } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

function LegalDoc({ title, sections }: { title: string; sections: LegalSection[] }) {
  const { t } = useLocale()
  return (
    <div className="pb-12">
      <PageHeader title={title} back="/" />
      <article className="mx-auto max-w-lg space-y-6 p-5 text-sm leading-relaxed text-ink-2">
        <p className="text-xs text-ink-2">{t.legal.lastUpdatedLabel} {t.legal.lastUpdated}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="display text-lg font-bold text-ink">{s.title}</h2>
            <p className="mt-2">{s.body}</p>
          </section>
        ))}
        <p className="border-t border-line pt-4 text-xs">{t.legal.disclaimer}</p>
      </article>
    </div>
  )
}

export function TermsPage() {
  const { t } = useLocale()
  return <LegalDoc title={t.legal.termsTitle} sections={t.legal.terms} />
}

export function PrivacyPage() {
  const { t } = useLocale()
  return <LegalDoc title={t.legal.privacyTitle} sections={t.legal.privacy} />
}

export function LegalFooter({ className = '' }: { className?: string }) {
  const { t } = useLocale()
  return (
    <p className={`text-center text-xs text-ink-2 ${className}`}>
      <Link to="/terms" className="font-semibold text-brand hover:underline">{t.legal.termsLink}</Link>
      {' · '}
      <Link to="/privacy" className="font-semibold text-brand hover:underline">{t.legal.privacyLink}</Link>
    </p>
  )
}
