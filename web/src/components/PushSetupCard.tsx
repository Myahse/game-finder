import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
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
        {detail && (
          <p className="mt-2 break-words rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink-2">
            {t.pushSetup.details}: {detail}
          </p>
        )}
      </div>
    </Card>
  )
}
