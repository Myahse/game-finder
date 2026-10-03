import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../lib/api'
import { PageHeader, Spinner } from '../components/ui'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')?.trim() ?? ''
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('This verification link is missing a token.')
      return
    }
    setState('loading')
    void api<{ verified: boolean }>('/api/auth/verify-email', { method: 'POST', json: { token } })
      .then(() => setState('ok'))
      .catch((e) => {
        setState('error')
        setMessage(errorMessage(e))
      })
  }, [token])

  return (
    <div className="mx-auto max-w-md p-6">
      <PageHeader title="Verify email" back="/login" />
      {state === 'loading' && (
        <div className="flex justify-center py-12">
          <Spinner className="text-brand" />
        </div>
      )}
      {state === 'ok' && (
        <div className="rounded-xl bg-surface-2 p-5 text-center">
          <p className="font-semibold text-ink">Email verified.</p>
          <p className="mt-2 text-sm text-ink-2">You can sign in and use the app.</p>
          <Link to="/login" className="display mt-4 block w-full rounded-xl bg-brand py-3 text-center text-lg font-bold text-white">
            Sign in
          </Link>
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-xl bg-danger/10 p-5 text-center">
          <p className="font-semibold text-ink">Could not verify</p>
          <p className="mt-2 text-sm text-ink-2">{message}</p>
          <Link to="/login" className="display mt-4 block w-full rounded-xl bg-surface-2 py-3 text-center text-lg font-bold text-ink">
            Back to sign in
          </Link>
        </div>
      )}
    </div>
  )
}
