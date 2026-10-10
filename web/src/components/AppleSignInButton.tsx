import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { firebaseAppleIdToken, firebaseAuthEnabled, isAppleSignInEnabled, signInErrorText } from '../lib/firebase'
import { useLocale } from '../i18n/LocaleProvider'
import { ErrorText, Spinner } from './ui'

/** Off by default — needs Apple Developer + Firebase Apple provider (see scripts/setup-apple-auth.md). */
export const appleSignInEnabled = firebaseAuthEnabled && isAppleSignInEnabled()

export function AppleSignInButton({
  onSignedIn,
  showTerms = true,
}: {
  onSignedIn?: () => void
  showTerms?: boolean
}) {
  const { googleSignIn } = useAuth()
  const { t } = useLocale()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!appleSignInEnabled) return null

  const terms = showTerms && (
    <p className="text-center text-xs text-ink-2">
      {t.welcome.appleTerms}{' '}
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

  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setError('')
          void firebaseAppleIdToken()
            .then((token) => googleSignIn(token, true))
            .then(() => onSignedIn?.())
            .catch((e) => {
              const text = signInErrorText(e)
              if (text !== null) setError(text ?? errorMessage(e))
            })
            .finally(() => setBusy(false))
        }}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full bg-black px-4 text-[15px] font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy ? <Spinner className="text-current" /> : <AppleIcon />}
        {t.welcome.continueApple}
      </button>
      <ErrorText>{error}</ErrorText>
      {terms}
    </div>
  )
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}
