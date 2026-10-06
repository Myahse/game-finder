import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { firebaseGoogleEnabled, firebaseGoogleIdToken } from '../lib/firebase'
import { appleSignInEnabled } from './AppleSignInButton'
import { useLocale } from '../i18n/LocaleProvider'
import { useTheme } from '../theme/ThemeProvider'
import { ErrorText, Spinner } from './ui'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type GsiCredential = { credential: string }
type Gsi = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: GsiCredential) => void; ux_mode?: 'popup'; use_fedcm_for_button?: boolean }) => void
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
    }
  }
}
declare global {
  interface Window {
    google?: Gsi
  }
}

let scriptPromise: Promise<Gsi> | null = null

function loadGsi(): Promise<Gsi> {
  scriptPromise ??= new Promise<Gsi>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google)
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.onload = () => (window.google ? resolve(window.google) : reject(new Error('gsi missing')))
    el.onerror = () => {
      scriptPromise = null
      reject(new Error('gsi failed to load'))
    }
    document.head.appendChild(el)
  })
  return scriptPromise
}

/** Prefer Firebase when configured (no manual Google Cloud OAuth clients). */
const useFirebase = firebaseGoogleEnabled
export const googleSignInEnabled = useFirebase || CLIENT_ID !== ''

export function GoogleSignInButton({
  onSignedIn,
  showTerms = true,
  /** Where to go after sign-in; `null` skips navigation (use `onSignedIn`). */
  navigateAfterSignIn = '/',
}: {
  onSignedIn?: () => void
  showTerms?: boolean
  navigateAfterSignIn?: string | null
}) {
  const { googleSignIn, sessionReady } = useAuth()
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const signInFlight = useRef(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(useFirebase)
  const { isDark: dark } = useTheme()

  const finish = async (idToken: string, viaFirebase: boolean) => {
    if (!sessionReady || signInFlight.current) return
    signInFlight.current = true
    setBusy(true)
    setError('')
    try {
      await googleSignIn(idToken, viaFirebase)
      onSignedIn?.()
      if (navigateAfterSignIn !== null) navigate(navigateAfterSignIn, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      signInFlight.current = false
      setBusy(false)
    }
  }

  const handler = useRef<(r: GsiCredential) => void>(() => {})
  useEffect(() => {
    handler.current = ({ credential }) => finish(credential, false)
  })

  useEffect(() => {
    if (useFirebase || !CLIENT_ID) return
    let cancelled = false
    loadGsi()
      .then((g) => {
        if (cancelled || !box.current) return
        box.current.replaceChildren()
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => handler.current(r),
          ux_mode: 'popup',
          use_fedcm_for_button: false,
        })
        g.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          locale,
          width: Math.min(box.current.clientWidth || 400, 400),
        })
        setReady(true)
      })
      .catch(() => !cancelled && setError(t.welcome.googleFailed))
    return () => {
      cancelled = true
    }
  }, [dark, locale, t.welcome.googleFailed])

  if (!googleSignInEnabled) return null

  const terms = showTerms && (
    <p className="text-center text-xs text-ink-2">
      {t.welcome.googleTerms}{' '}
      <Link to="/terms" className="font-semibold text-brand hover:underline">
        {t.welcome.terms}
      </Link>{' '}
      {t.welcome.and}{' '}
      <Link to="/privacy" className="font-semibold text-brand hover:underline">
        {t.welcome.privacy}
      </Link>
      .
    </p>
  )

  if (useFirebase) {
    return (
      <div className="grid gap-2">
        <button
          type="button"
          disabled={busy || !sessionReady}
          onClick={() => {
            if (!sessionReady) return
            void firebaseGoogleIdToken()
              .then((token) => finish(token, true))
              .catch((e) => setError(errorMessage(e)))
          }}
          className={
            dark
              ? 'flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-[#131314] px-4 text-[15px] font-semibold text-[#E3E3E3] ring-1 ring-[#8E918F] disabled:opacity-50'
              : 'flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 text-[15px] font-semibold text-ink shadow-sm disabled:opacity-50'
          }
        >
          {busy ? <Spinner className={dark ? 'text-[#E3E3E3]' : 'text-ink-2'} /> : <GoogleGIcon />}
          {t.account.continueGoogle}
        </button>
        <ErrorText>{error}</ErrorText>
        {terms}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="relative flex min-h-11 items-center justify-center">
        <div
          ref={box}
          className={`flex w-full justify-center ${busy || !sessionReady ? 'pointer-events-none opacity-50' : ''}`}
        />
        {(!ready || !sessionReady || busy) && !error && <Spinner className="absolute text-ink-2" />}
      </div>
      <ErrorText>{error}</ErrorText>
      {terms}
    </div>
  )
}

function GoogleGIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.56 2.95-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function OrDivider({ className = '' }: { className?: string }) {
  const { t } = useLocale()
  if (!googleSignInEnabled && !appleSignInEnabled) return null
  return (
    <div className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-wide opacity-60 ${className}`}>
      <span className="h-px flex-1 bg-current opacity-30" />
      {t.welcome.or}
      <span className="h-px flex-1 bg-current opacity-30" />
    </div>
  )
}
