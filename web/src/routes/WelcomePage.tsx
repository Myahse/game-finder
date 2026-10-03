import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GoogleSignInButton, OrDivider } from '../components/GoogleSignInButton'
import { LoginBottomSheet } from '../components/LoginBottomSheet'
import { SportPhotoBackdrop } from '../components/SportPhotoBackdrop'
import { PlatformIntroModal } from '../components/PlatformIntroModal'
import { useLocale } from '../i18n/LocaleProvider'
import { guestIntroSeen, markGuestIntroSeen } from '../lib/platformIntro'
import { LegalFooter } from './LegalPage'

/** Landing at `/` — sport photos up top; light/dark still follows the device via theme tokens. */
export function WelcomePage() {
  const { t } = useLocale()
  const [params, setParams] = useSearchParams()
  const [loginOpen, setLoginOpen] = useState(() => params.get('login') === '1')
  const [introOpen, setIntroOpen] = useState(false)

  useEffect(() => {
    if (params.get('login') === '1') setLoginOpen(true)
  }, [params])

  useEffect(() => {
    if (guestIntroSeen()) return
    const timer = window.setTimeout(() => setIntroOpen(true), 400)
    return () => window.clearTimeout(timer)
  }, [])

  const closeIntro = () => {
    markGuestIntroSeen()
    setIntroOpen(false)
  }

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
        <SportPhotoBackdrop />

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-end px-6 pb-10 pt-[46vh] lg:mx-0 lg:ml-[max(3rem,calc(22vw-14rem))] lg:justify-center lg:py-12">
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
            <button
              type="button"
              onClick={() => setIntroOpen(true)}
              className="text-center text-sm font-semibold text-brand"
            >
              {t.welcome.howTitle}
            </button>
            <LegalFooter className="mt-4 text-ink-2 [&_a]:text-brand" />
          </div>
        </div>
      </div>

      <PlatformIntroModal open={introOpen} onClose={closeIntro} variant="guest" />
      <LoginBottomSheet open={loginOpen} onClose={closeLogin} />
    </>
  )
}
