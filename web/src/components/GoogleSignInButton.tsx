import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLocale } from '../i18n/LocaleProvider'
import { ErrorText, Spinner } from './ui'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

// Minimal typing for Google Identity Services.
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

export const googleSignInEnabled = CLIENT_ID !== ''

/**
 * "Continue with Google" using Google's own button (required by their brand
 * rules). Signs in, links to an existing account with the same email, or
 * creates a new account that then goes through onboarding.
 */
export function GoogleSignInButton({ onSignedIn, showTerms = true }: { onSignedIn?: () => void; showTerms?: boolean }) {
  const { googleSignIn } = useAuth()
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  // Keep the latest handlers without re-rendering Google's button.
  const handler = useRef<(r: GsiCredential) => void>(() => {})
  useEffect(() => {
    handler.current = async ({ credential }) => {
      setBusy(true)
      setError('')
      try {
        const isNew = await googleSignIn(credential)
        onSignedIn?.()
        navigate(isNew ? '/onboarding' : '/', { replace: true })
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    }
  })

  useEffect(() => {
    if (!googleSignInEnabled) return
    let cancelled = false
    loadGsi()
      .then((g) => {
        if (cancelled || !box.current) return
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => handler.current(r),
          ux_mode: 'popup',
          use_fedcm_for_button: true,
        })
        g.accounts.id.renderButton(box.current, {
          type: 'standard',
          theme: 'filled_black',
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
  }, [locale, t.welcome.googleFailed])

  if (!googleSignInEnabled) return null

  return (
    <div className="grid gap-2">
      <div className="relative flex min-h-11 items-center justify-center">
        <div ref={box} className={`flex w-full justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} />
        {(!ready || busy) && !error && <Spinner className="absolute text-ink-2" />}
      </div>
      <ErrorText>{error}</ErrorText>
      {showTerms && (
        <p className="text-center text-xs text-[#9aa3ae]">
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
      )}
    </div>
  )
}

/** "— or —" separator shown between Google and email sign-in. */
export function OrDivider({ className = '' }: { className?: string }) {
  const { t } = useLocale()
  if (!googleSignInEnabled) return null
  return (
    <div className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-wide opacity-60 ${className}`}>
      <span className="h-px flex-1 bg-current opacity-30" />
      {t.welcome.or}
      <span className="h-px flex-1 bg-current opacity-30" />
    </div>
  )
}
