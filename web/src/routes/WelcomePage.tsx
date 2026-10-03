import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GoogleSignInButton, OrDivider } from '../components/GoogleSignInButton'
import { LoginBottomSheet } from '../components/LoginBottomSheet'
import { useLocale } from '../i18n/LocaleProvider'
import { LegalFooter } from './LegalPage'

/** Landing at `/` — follows system light/dark via app theme tokens. */
export function WelcomePage() {
  const { t } = useLocale()
  const [params, setParams] = useSearchParams()
  const [loginOpen, setLoginOpen] = useState(() => params.get('login') === '1')

  useEffect(() => {
    if (params.get('login') === '1') setLoginOpen(true)
  }, [params])

  const openLogin = () => {
    setLoginOpen(true)
    setParams({ login: '1' }, { replace: true })
  }

  const closeLogin = () => {
    setLoginOpen(false)
    if (params.has('login')) setParams({}, { replace: true })
  }

  return (
    <>
      <div className="relative flex min-h-full flex-col overflow-hidden bg-bg text-ink">
        <svg
          className="pointer-events-none absolute -right-32 -top-24 h-[640px] w-[640px] text-brand/25"
          viewBox="0 0 400 400"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden
        >
          <circle cx="200" cy="200" r="190" />
          <circle cx="200" cy="200" r="60" />
          <path d="M10 200h380M200 10v380" />
          <path d="M60 60c60 60 60 220 0 280M340 60c-60 60-60 220 0 280" />
        </svg>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-6 pb-10 pt-24">
          <div className="mb-6 flex items-center gap-2 text-sm font-semibold text-ink-2">
            <span className="relative inline-flex size-2.5 text-live">
              <span className="pulse relative size-2.5 rounded-full bg-current" />
            </span>
            {t.welcome.live}
          </div>
          <h1 className="display text-7xl font-extrabold sm:text-8xl">
            {t.welcome.titleLine1}
            <br />
            <span className="text-brand">{t.welcome.titleLine2}</span>
          </h1>
          <p className="mt-5 text-xl text-ink-2">
            {t.welcome.tagline1}
            <br />
            <b className="text-ink">{t.welcome.tagline2}</b>
          </p>

          <div className="mt-10 grid gap-3">
            <GoogleSignInButton />
            <OrDivider className="my-1 text-ink-2" />
            <Link
              to="/register"
              className="display flex min-h-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-brand-ink"
            >
              {t.welcome.createAccount}
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="display flex min-h-14 items-center justify-center rounded-2xl border border-line bg-surface/50 text-2xl font-bold backdrop-blur-sm"
            >
              {t.welcome.logIn}
            </button>
            <LegalFooter className="mt-4 text-ink-2 [&_a]:text-brand" />
          </div>
        </div>
      </div>

      <LoginBottomSheet open={loginOpen} onClose={closeLogin} />
    </>
  )
}
