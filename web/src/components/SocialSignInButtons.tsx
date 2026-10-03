import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/LocaleProvider'
import { preferAppleSignIn } from '../lib/firebase'
import { AppleSignInButton, appleSignInEnabled } from './AppleSignInButton'
import { GoogleSignInButton, googleSignInEnabled } from './GoogleSignInButton'

export const socialSignInEnabled = googleSignInEnabled || appleSignInEnabled

type Props = {
  onSignedIn?: () => void
  showTerms?: boolean
  navigateAfterSignIn?: string | null
}

function SocialTerms() {
  const { t } = useLocale()
  return (
    <p className="text-center text-xs text-ink-2">
      {t.welcome.socialTerms}{' '}
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
}

/** Google + Apple (Firebase). Apple is listed first on iPhone/iPad. */
export function SocialSignInButtons({ onSignedIn, showTerms = true, navigateAfterSignIn = '/' }: Props) {
  if (!socialSignInEnabled) return null
  const appleFirst = preferAppleSignIn()
  const google = (
    <GoogleSignInButton onSignedIn={onSignedIn} showTerms={false} navigateAfterSignIn={navigateAfterSignIn} />
  )
  const apple = <AppleSignInButton onSignedIn={onSignedIn} showTerms={false} />
  return (
    <div className="grid gap-2">
      {appleFirst ? (
        <>
          {apple}
          {google}
        </>
      ) : (
        <>
          {google}
          {apple}
        </>
      )}
      {showTerms ? <SocialTerms /> : null}
    </div>
  )
}
