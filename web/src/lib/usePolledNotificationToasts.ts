import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { AppNotification } from './types'
import { notificationLink } from './notificationLinks'

/** Toasts for new rows from /api/notifications polling (works when WebSocket is down). */
export function usePolledNotificationToasts(
  items: AppNotification[] | undefined,
  enabled: boolean,
  openLabel: string,
) {
  const navigate = useNavigate()
  const seeded = useRef(false)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || !items) return
    if (!seeded.current) {
      for (const n of items) seen.current.add(n.id)
      seeded.current = true
      return
    }
    for (const n of items) {
      if (seen.current.has(n.id)) continue
      seen.current.add(n.id)
      if (n.type === 'presence_check') continue
      const link = notificationLink(n)
      toast(n.title, {
        id: n.id,
        description: n.body,
        duration: 6000,
        action: link
          ? {
              label: openLabel,
              onClick: () => navigate(link),
            }
          : undefined,
      })
    }
  }, [enabled, items, navigate, openLabel])
}
