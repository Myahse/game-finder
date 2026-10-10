import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { api, errorMessage } from '../lib/api'
import type { Me } from '../lib/types'
import { Button, Card, ErrorText, Field } from './ui'
import { PasswordField } from './PasswordStrength'

/** Google/Apple accounts can add a password (username login); others can change it. */
export function PasswordCard({ me }: { me: Me }) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const adding = me.has_password === false
  const [open, setOpen] = useState(adding)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/api/me/password', { method: 'POST', json: { current_password: adding ? undefined : current, new_password: next } })
      toast.success(adding ? t.password.added.replace('{user}', me.username) : t.password.changed)
      setCurrent('')
      setNext('')
      setOpen(false)
      await qc.invalidateQueries({ queryKey: ['me'] })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound className="size-5" aria-hidden /> {t.password.change}
      </Button>
    )
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="font-bold">{adding ? t.password.addTitle : t.password.changeTitle}</p>
            {adding && <p className="text-sm text-ink-2">{t.password.addBody.replace('{user}', me.username)}</p>}
          </div>
        </div>
        {!adding && (
          <Field label={t.password.current}>
            <PasswordField required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        )}
        <Field label={t.password.new} hint={t.password.hint}>
          <PasswordField meter required minLength={8} maxLength={72} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          {!adding && (
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              {t.scoreboard.cancel}
            </Button>
          )}
          <Button type="submit" className="flex-1" loading={busy} disabled={next.length < 8}>
            {t.password.save}
          </Button>
        </div>
      </form>
    </Card>
  )
}
