import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { dismissPromptLater, isIos, isStandalonePwa, promptDismissed, PROMPT_KEYS } from '../lib/promptDismiss'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NOTIFY_TOAST_ID = 'ftg-enable-notifications'
const INSTALL_TOAST_ID = 'ftg-install-app'

function showNotificationPrompt(onDone: () => void) {
  if (!('Notification' in window)) {
    onDone()
    return
  }
  if (Notification.permission !== 'default' || promptDismissed(PROMPT_KEYS.notifications)) {
    onDone()
    return
  }

  toast('Turn on notifications', {
    id: NOTIFY_TOAST_ID,
    description:
      'Shows alerts when this tab is in the background. In-app toasts still work while Find the Game is open. Allow location on the map for nearby game alerts.',
    duration: Infinity,
    action: {
      label: 'Enable',
      onClick: () => {
        void Notification.requestPermission().then((perm) => {
          toast.dismiss(NOTIFY_TOAST_ID)
          if (perm === 'granted') {
            toast.success('Notifications enabled')
          } else if (perm === 'denied') {
            toast.message('Notifications blocked', {
              description: 'Allow notifications in your browser settings to get alerts.',
            })
          }
          onDone()
        })
      },
    },
    cancel: {
      label: 'Later',
      onClick: () => {
        dismissPromptLater(PROMPT_KEYS.notifications)
        toast.dismiss(NOTIFY_TOAST_ID)
        onDone()
      },
    },
  })
}

function showInstallPrompt(deferred: BeforeInstallPromptEvent | null, onDone: () => void) {
  if (isStandalonePwa() || promptDismissed(PROMPT_KEYS.install)) {
    onDone()
    return
  }

  if (deferred) {
    toast('Install Find the Game', {
      id: INSTALL_TOAST_ID,
      description: 'Open the app from your home screen — faster map and live game updates.',
      duration: Infinity,
      action: {
        label: 'Install',
        onClick: () => {
          void deferred.prompt().then(() =>
            deferred.userChoice.then(({ outcome }) => {
              toast.dismiss(INSTALL_TOAST_ID)
              if (outcome === 'accepted') toast.success('App installed')
              onDone()
            }),
          )
        },
      },
      cancel: {
        label: 'Later',
        onClick: () => {
          dismissPromptLater(PROMPT_KEYS.install)
          toast.dismiss(INSTALL_TOAST_ID)
          onDone()
        },
      },
    })
    return
  }

  if (isIos()) {
    toast('Add to Home Screen', {
      id: INSTALL_TOAST_ID,
      description: 'Tap Share, then “Add to Home Screen” to install the app.',
      duration: Infinity,
      cancel: {
        label: 'Later',
        onClick: () => {
          dismissPromptLater(PROMPT_KEYS.install)
          toast.dismiss(INSTALL_TOAST_ID)
          onDone()
        },
      },
    })
  }
}

/** Sonner prompts: notifications first, then optional PWA install. */
const SESSION_KEY = 'ftg_engagement_prompts_cycle'

export function EngagementPrompts({ enabled }: { enabled: boolean }) {
  const installEvent = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault()
      installEvent.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
  }, [])

  useEffect(() => {
    if (!enabled) return
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {
      // ignore
    }

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // ignore
      }
      showNotificationPrompt(() => {
        window.setTimeout(() => showInstallPrompt(installEvent.current, () => {}), 400)
      })
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [enabled])

  return null
}
