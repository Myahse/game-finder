import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, api, errorMessage, setSession, uploadImage } from '../lib/api'
import { isUsernameTaken } from '../lib/usernameCheck'
import { useAuth } from '../lib/auth'
import { OrDivider } from '../components/GoogleSignInButton'
import { SocialSignInButtons } from '../components/SocialSignInButtons'
import { Avatar, Button, ErrorText, Field, Input, PageHeader, PasswordInput } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'

export function LoginPage() {
  return <Navigate to="/?login=1" replace />
}

export function RegisterPage() {
  const { register } = useAuth()
  const { t } = useLocale()
  const a = t.account.register
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const checkUsername = async () => {
    setUsernameTaken(await isUsernameTaken(form.username))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
      })
      try {
        await api('/api/me')
      } catch (err) {
        if (err instanceof ApiError && err.code === 'email_not_verified') {
          await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
          setSession(null)
          setCheckEmail(form.email)
          return
        }
        throw err
      }
      if (photo) {
        const url = await uploadImage(photo, 'avatar').catch(() => null)
        if (url) await api('/api/me', { method: 'PATCH', json: { avatar_url: url } }).catch(() => {})
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-full">
        <PageHeader title={a.checkEmailTitle} back="/" />
        <div className="mx-auto max-w-md p-5 text-center">
          <p className="text-ink">
            {a.checkEmailBefore}<span className="font-semibold">{checkEmail}</span>{a.checkEmailAfter}
          </p>
          <p className="mt-3 text-sm text-ink-2">{a.checkEmailNote}</p>
          <Link
            to="/?login=1"
            className="display mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white"
          >
            {a.goToLogin}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <PageHeader title={t.welcome.createAccount} back="/" />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-4 p-5">
        <SocialSignInButtons />
        <OrDivider className="text-ink-2" />
        <label className="flex cursor-pointer items-center gap-4">
          <Avatar
            size={64}
            user={{
              username: form.username || 'new',
              first_name: form.first_name || '+',
              last_name: form.last_name,
              avatar_url: photo ? URL.createObjectURL(photo) : null,
            }}
          />
          <span className="text-sm font-semibold text-brand">{photo ? t.common.changePhoto : a.addPhoto}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.profile.firstName}>
            <Input required autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
          </Field>
          <Field label={t.profile.lastName}>
            <Input required autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <Field label={t.profile.username} hint={usernameTaken ? <span className="text-danger">{t.onboarding.usernameTaken}</span> : t.onboarding.usernameHint}>
          <Input
            required
            pattern="[A-Za-z0-9_.]{3,24}"
            autoComplete="username"
            value={form.username}
            onChange={(e) => {
              setUsernameTaken(false)
              set('username')(e)
            }}
            onBlur={checkUsername}
          />
        </Field>
        <Field label={t.onboarding.email}>
          <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label={a.password} hint={a.passwordHint}>
          <PasswordInput required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-2">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-brand"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          <span>
            {a.agreeTo}{' '}
            <Link to="/terms" className="font-semibold text-brand hover:underline" target="_blank" rel="noreferrer">
              {t.welcome.terms}
            </Link>{' '}
            {t.welcome.and}{' '}
            <Link to="/privacy" className="font-semibold text-brand hover:underline" target="_blank" rel="noreferrer">
              {t.welcome.privacy}
            </Link>
            {a.agreeEnd}
          </span>
        </label>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={usernameTaken || !agreed}>
          {t.welcome.createAccount}
        </Button>
        <p className="text-center text-sm text-ink-2">
          {a.alreadyPlaying}{' '}
          <Link to="/?login=1" className="font-semibold text-brand">
            {t.welcome.logIn}
          </Link>
        </p>
      </form>
    </div>
  )
}
