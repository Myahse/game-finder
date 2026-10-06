import { isRouteErrorResponse, Link, useNavigate, useRouteError } from 'react-router-dom'
import { ArrowLeft, MapPin, RotateCw } from 'lucide-react'
import { BaseSportIcon } from '../components/icons'
import { useLocale } from '../i18n/LocaleProvider'

/** The ball bounced off the court: big 404 over court lines, ball out of bounds. */
function OutOfBounds({ code }: { code: string }) {
  return (
    <div className="relative mx-auto h-48 w-full max-w-xs" aria-hidden>
      {/* Court: boundary + centre line + circle */}
      <svg viewBox="0 0 320 180" className="absolute inset-0 size-full text-line">
        <rect x="12" y="20" width="236" height="140" rx="6" fill="none" stroke="currentColor" strokeWidth="4" />
        <line x1="130" y1="20" x2="130" y2="160" stroke="currentColor" strokeWidth="4" />
        <circle cx="130" cy="90" r="26" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
      <p className="display absolute left-[38%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl font-extrabold tracking-tight text-ink">{code}</p>
      {/* The ball, out past the line */}
      <span className="ftg-oob-ball absolute right-2 top-6 flex size-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg">
        <BaseSportIcon className="size-8" />
      </span>
      <span className="ftg-oob-shadow absolute bottom-3 right-4 h-2 w-10 rounded-full bg-ink/15" />
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
