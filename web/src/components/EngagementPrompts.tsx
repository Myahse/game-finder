import { useEffect, useRef } from 'react'
import { registerWebPush } from '../lib/webPush'
import { toast } from 'sonner'
import { playInstallDock } from '../lib/installDock'
import { currentT } from '../i18n/LocaleProvider'
import { dismissPromptLater, isIos, isStandalonePwa, promptDismissed, PROMPT_KEYS } from '../lib/promptDismiss'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NOTIFY_TOAST_ID = 'ftg-enable-notifications'
const AVATAR_TOAST_ID = 'ftg-create-avatar'
const INSTALL_TOAST_ID = 'ftg-install-app'

function showAvatarPrompt(onCreate: (() => void) | null, labels: AvatarPromptLabels, onDone: () => void) {
  if (!onCreate || promptDismissed(PROMPT_KEYS.avatar)) {
    onDone()
    return
  }
  toast(labels.title, {
    id: AVATAR_TOAST_ID,
    description: labels.body,
    duration: Infinity,
    action: {
      label: labels.create,
      onClick: () => {
        dismissPromptLater(PROMPT_KEYS.avatar)
        toast.dismiss(AVATAR_TOAST_ID)
        onCreate()
      },
    },
    cancel: {
      label: labels.later,
      onClick: () => {
        dismissPromptLater(PROMPT_KEYS.avatar)
        toast.dismiss(AVATAR_TOAST_ID)
        onDone()
      },
    },
  })
}

function showNotificationPrompt(onDone: () => void) {
  if (!('Notification' in window)) {
    onDone()
    return
  }
  if (Notification.permission !== 'default' || promptDismissed(PROMPT_KEYS.notifications)) {
    onDone()
    return
  }

  const p = currentT().account.prompts
  toast(p.notifyTitle, {
    id: NOTIFY_TOAST_ID,
    description: p.notifyBody,
    duration: Infinity,
    action: {
      label: p.enable,
      onClick: () => {
        void Notification.requestPermission().then((perm) => {
          toast.dismiss(NOTIFY_TOAST_ID)
          if (perm === 'granted') {
            void registerWebPush()
            toast.success(p.notifyEnabled)
          } else if (perm === 'denied') {
            toast.message(p.notifyBlocked, {
              description: p.notifyBlockedBody,
            })
          }
          onDone()
        })
      },
    },
    cancel: {
      label: p.later,
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

  const p = currentT().account.prompts
  if (deferred) {
    toast(p.installTitle, {
      id: INSTALL_TOAST_ID,
      description: p.installBody,
      duration: Infinity,
      action: {
        label: p.install,
        onClick: () => {
          void deferred.prompt().then(() =>
            deferred.userChoice.then(({ outcome }) => {
              toast.dismiss(INSTALL_TOAST_ID)
              if (outcome === 'accepted') {
                // Installed: the icon drops into a dock, then the usual confirmation.
                playInstallDock()
                window.setTimeout(() => toast.success(p.installed), 1600)
              }
              onDone()
            }),
          )
        },
      },
      cancel: {
        label: p.later,
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
    toast(p.iosTitle, {
      id: INSTALL_TOAST_ID,
      description: p.iosBody,
      duration: Infinity,
      cancel: {
        label: p.later,
        onClick: () => {
          dismissPromptLater(PROMPT_KEYS.install)
          toast.dismiss(INSTALL_TOAST_ID)
          onDone()
        },
      },
    })
  }
}

type AvatarPromptLabels = { title: string; body: string; create: string; later: string }

/** Sonner prompts: avatar (players without one), then notifications, then optional PWA install. */
const SESSION_KEY = 'ftg_engagement_prompts_cycle'

export function EngagementPrompts({
  enabled,
  onCreateAvatar = null,
  avatarLabels,
}: {
  enabled: boolean
  /** Set when the player has no avatar yet — offers to create one (at most weekly). */
  onCreateAvatar?: (() => void) | null
  avatarLabels: AvatarPromptLabels
}) {
  const avatarRef = useRef({ onCreateAvatar, avatarLabels })
  useEffect(() => {
    avatarRef.current = { onCreateAvatar, avatarLabels }
  })

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
      const { onCreateAvatar: create, avatarLabels: labels } = avatarRef.current
      showAvatarPrompt(create, labels, () =>
        showNotificationPrompt(() => {
          window.setTimeout(() => showInstallPrompt(installEvent.current, () => {}), 400)
        }),
      )
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [enabled])

  return null
}
