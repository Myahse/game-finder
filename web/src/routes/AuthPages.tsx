import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, uploadImage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Avatar, Button, ErrorText, Field, Input, PageHeader } from '../components/ui'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Log in" back="/welcome" />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-4 p-5">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy}>
          Log in
        </Button>
        <p className="text-center text-sm text-ink-2">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const checkUsername = async () => {
    if (form.username.length < 3) return
    const r = await api<{ available: boolean }>(`/api/auth/username-available?username=${encodeURIComponent(form.username)}`).catch(() => null)
    setUsernameTaken(r ? !r.available : false)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await register(form)
      if (photo) {
        // Upload needs a session, so it happens right after sign-up.
        const url = await uploadImage(photo, 'avatar').catch(() => null)
        if (url) await api('/api/me', { method: 'PATCH', json: { avatar_url: url } }).catch(() => {})
      }
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader title="Create account" back="/welcome" />
      <form onSubmit={submit} className="mx-auto grid max-w-md gap-4 p-5">
        <label className="flex cursor-pointer items-center gap-4">
          <Avatar
            size={64}
            user={{ first_name: form.first_name || '+', last_name: form.last_name, avatar_url: photo ? URL.createObjectURL(photo) : null }}
          />
          <span className="text-sm font-semibold text-brand">{photo ? 'Change photo' : 'Add profile photo (optional)'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input required autoComplete="given-name" value={form.first_name} onChange={set('first_name')} />
          </Field>
          <Field label="Last name">
            <Input required autoComplete="family-name" value={form.last_name} onChange={set('last_name')} />
          </Field>
        </div>
        <Field label="Username" hint={usernameTaken ? <span className="text-danger">That username is taken.</span> : '3–24 letters, numbers, _ or .'}>
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
        <Field label="Email">
          <Input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} disabled={usernameTaken}>
          Create account
        </Button>
        <p className="text-center text-sm text-ink-2">
          Already playing?{' '}
          <Link to="/login" className="font-semibold text-brand">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
