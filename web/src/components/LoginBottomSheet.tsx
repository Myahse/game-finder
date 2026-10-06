import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { pendingGamePathAfterAuth } from '../lib/gameInvite'
import { OrDivider } from './GoogleSignInButton'
import { SocialSignInButtons } from './SocialSignInButtons'
import { Button, ErrorText, Field, Input, PasswordInput } from './ui'
import { useLocale } from '../i18n/LocaleProvider'

type Props = {
  open: boolean
  onClose: () => void
}

export function LoginBottomSheet({ open, onClose }: Props) {
  const { login } = useAuth()
  const { t } = useLocale()
  const l = t.account.login
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Mobile browsers: keep the sheet above the on-screen keyboard.
  useEffect(() => {
    if (!open) {
      setKeyboardInset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const gap = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardInset(gap > 0 ? gap : 0)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [open])

  if (!open) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(loginId, password)
      setLoginId('')
      setPassword('')
      onClose()
      navigate(pendingGamePathAfterAuth() ?? '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[min(90dvh,640px)] overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-[margin] duration-150 sm:max-h-none sm:rounded-3xl sm:border"
        style={{ marginBottom: keyboardInset > 0 ? keyboardInset : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-line" />
        </div>
        <h2 id="login-sheet-title" className="display text-3xl font-extrabold">{t.welcome.logIn}</h2>
        <p className="mt-1 text-sm text-ink-2">{l.subtitle}</p>

        <div className="mt-5 grid gap-3">
          <SocialSignInButtons
            onSignedIn={onClose}
            showTerms={false}
            navigateAfterSignIn={pendingGamePathAfterAuth() ?? '/'}
          />
          <OrDivider className="text-ink-2" />
        </div>
        <form onSubmit={submit} className="mt-4 grid gap-4">
          <Field label={l.emailOrUsername}>
            <Input
              type="text"
              autoComplete="username"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </Field>
          <Field label={t.account.register.password}>
            <PasswordInput
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={busy}>{t.welcome.logIn}</Button>
          <p className="text-center text-sm text-ink-2">
            {l.newHere}{' '}
            <Link to="/register" className="font-semibold text-brand" onClick={onClose}>
              {l.createAnAccount}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
