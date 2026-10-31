import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Me } from '../lib/types'
import { Button, Card, ErrorText, Field } from './ui'
import { PasswordField } from './PasswordStrength'

/** Bottom of the profile: permanent account deletion (store requirement, see /delete-account). */
export function DeleteAccountCard({ me }: { me: Me }) {
  const { t } = useLocale()
  const { deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const needsPassword = me.has_password !== false

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (needsPassword && !password) return setError(t.deleteAccount.passwordRequired)
    setError('')
    setBusy(true)
    try {
      await deleteAccount(needsPassword ? password : undefined)
      toast.success(t.deleteAccount.done)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button id="delete-account" type="button" variant="ghost" className="text-danger hover:text-danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-5" aria-hidden /> {t.deleteAccount.button}
      </Button>
    )
  }

  return (
    <Card className="border-danger/40">
      <form onSubmit={submit} className="grid gap-3">
        <p className="font-bold text-danger">{t.deleteAccount.title}</p>
        <p className="text-sm text-ink-2">{t.deleteAccount.body.replace('{user}', me.username)}</p>
        {needsPassword && (
          <Field label={t.deleteAccount.password}>
            <PasswordField required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
            {t.deleteAccount.cancel}
          </Button>
          <Button type="submit" variant="danger" className="flex-1" loading={busy}>
            {t.deleteAccount.confirm}
          </Button>
        </div>
      </form>
    </Card>
  )
}
