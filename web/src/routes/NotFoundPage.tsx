import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router-dom'
import { ArrowLeft, MapPin, RotateCw } from 'lucide-react'
import { BaseSportIcon } from '../components/icons'
import { useLocale } from '../i18n/LocaleProvider'

/** The ball flies in, bounces off each digit of the code, then out of bounds. */
function OutOfBounds({ code }: { code: string }) {
  const digits = code.split('')
  return (
    <div className="relative mx-auto h-[200px] w-[320px] max-w-full" aria-hidden>
      {/* Court: boundary + centre line + circle */}
      <svg viewBox="0 0 320 200" className="absolute inset-0 size-full text-line">
        <rect x="8" y="40" width="250" height="150" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <line x1="133" y1="40" x2="133" y2="190" stroke="currentColor" strokeWidth="4" />
        <circle cx="133" cy="115" r="26" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
      <p className="display absolute left-6 top-14 flex text-8xl font-extrabold leading-none text-ink">
        {digits.map((d, i) => (
          <span key={i} className="ftg-oob-digit inline-block w-16 text-center" style={{ animationDelay: `${[0.48, 1.08, 1.68][i] ?? 0}s` }}>
            {d}
          </span>
        ))}
      </p>
      {/* x travel (outer) × bounces (inner) */}
      <span className="ftg-oob-x absolute left-0 top-4">
        <span className="ftg-oob-y flex size-12 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg">
          <BaseSportIcon className="size-7" />
        </span>
      </span>
    </div>
  )
}

function Shell({ code, title, body, primary }: { code: string; title: string; body: string; primary: React.ReactNode }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10 text-center">
      <OutOfBounds code={code} />
      <h1 className="display mt-6 text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 max-w-sm text-ink-2">{body}</p>
      <div className="mt-8 grid w-full max-w-xs gap-2">
        {primary}
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/', { replace: true }))}
          className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 px-5 text-lg font-bold text-ink hover:bg-line"
        >
          <ArrowLeft className="size-5" aria-hidden /> {t.notFound.back}
        </button>
      </div>
    </main>
  )
}

/** Unknown URL. */
export function NotFoundPage() {
  const { t } = useLocale()
  return (
    <Shell
      code={t.notFound.code}
      title={t.notFound.title}
      body={t.notFound.body}
      primary={
        <Link to="/" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-lg font-bold text-brand-ink hover:brightness-110">
          <MapPin className="size-5" aria-hidden /> {t.notFound.toMap}
        </Link>
      }
    />
  )
}

/** Route error boundary: 404 responses get the 404 page, crashes get a friendly retry. */
export function RouteErrorPage() {
  const { t } = useLocale()
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  if (import.meta.env.DEV) console.error(error)
  return (
    <Shell
      code="!"
      title={t.notFound.errorTitle}
      body={t.notFound.errorBody}
      primary={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-lg font-bold text-brand-ink hover:brightness-110"
        >
          <RotateCw className="size-5" aria-hidden /> {t.notFound.reload}
        </button>
      }
    />
  )
}
