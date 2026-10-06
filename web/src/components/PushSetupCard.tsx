import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../i18n/LocaleProvider'
import { api, errorMessage } from '../lib/api'
import { isIos, isStandalonePwa } from '../lib/promptDismiss'
import { registerWebPush } from '../lib/webPush'
import { Button, Card } from './ui'

type Perm = NotificationPermission | 'unsupported'

function currentPermission(): Perm {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Turn on push for this device + send a test, with the iPhone "add to Home Screen" hint. */
export function PushSetupCard() {
  const { t } = useLocale()
  const [perm, setPerm] = useState<Perm>(currentPermission)
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState('')
  const iosBrowser = isIos() && !isStandalonePwa()

  const enable = async () => {
    setBusy(true)
    try {
      const p = 'Notification' in window ? await Notification.requestPermission() : 'unsupported'
      setPerm(p)
      if (p === 'granted') {
        const reg = await registerWebPush()
        if (!reg.ok) setDetail(reg.reason)
      }
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    setDetail('')
    try {
      const reg = await registerWebPush()
      const r = await api<{ server_configured: boolean; devices: number; delivered: number; errors: string[] }>('/api/me/push-test', { method: 'POST' })
      if (!r.server_configured) {
        toast.message(t.pushSetup.serverOff)
      } else if (r.devices === 0) {
        toast.error(t.pushSetup.noDevice)
        setDetail(reg.ok ? '' : reg.reason)
      } else if (r.delivered > 0) {
        toast.success(t.pushSetup.testSent)
      } else {
        toast.error(t.pushSetup.failed)
        setDetail(r.errors.join(' · '))
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const text = iosBrowser
    ? t.pushSetup.iosInstall
    : perm === 'unsupported'
      ? t.pushSetup.unsupported
      : perm === 'denied'
        ? t.pushSetup.blocked
        : perm === 'granted'
          ? t.pushSetup.on
          : t.pushSetup.off

  return (
    <Card className="mb-4 flex items-start gap-3">
      <BellRing className={`mt-0.5 size-6 shrink-0 ${perm === 'granted' ? 'text-live' : 'text-brand'}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t.pushSetup.title}</p>
        <p className="text-sm text-ink-2">{text}</p>
        {!iosBrowser && perm === 'default' && (
          <Button type="button" className="mt-2 min-h-10 text-base" onClick={() => void enable()} loading={busy}>
            {t.pushSetup.enable}
          </Button>
        )}
        {!iosBrowser && perm === 'granted' && (
          <Button type="button" variant="secondary" className="mt-2 min-h-10 text-base" onClick={() => void test()} loading={busy}>
            {t.pushSetup.test}
          </Button>
        )}
        {detail && (
          <p className="mt-2 break-words rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-2">
            {t.pushSetup.details}: {detail}
          </p>
        )}
      </div>
    </Card>
  )
}
