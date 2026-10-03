import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ApiError } from './api'

type Copy = { title: string; description?: string }

const API_TOAST: Record<string, Copy> = {
  browse_location_mismatch: {
    title: 'Map area unavailable',
    description:
      'This view is far from your alert zone. Open the map where you play, or check in at a court when you travel — we update alerts from your location.',
  },
  notify_jump_too_far: {
    title: 'Alert area',
    description: 'Move your alert zone gradually, or check in at a court first.',
  },
  notify_rate_limited: {
    title: 'Alert area',
    description: 'You can change your alert zone again in a few minutes.',
  },
  rate_limited: {
    title: 'Slow down',
    description: 'Too many requests. Wait a minute and try again.',
  },
  too_many_pending_courts: {
    title: 'Court proposals',
    description: 'You already have pending courts waiting for review.',
  },
  too_far_from_court: {
    title: "You're not at the court",
    description: 'Move within about 500 m of the court to check in or join a live game.',
  },
  location_required: {
    title: 'Location needed',
    description: 'Turn on location so we can confirm you are at the court.',
  },
}

export function toastFromApiError(e: unknown, fallback = 'Something went wrong.') {
  if (e instanceof ApiError) {
    const c = API_TOAST[e.code]
    if (c) {
      toast.error(c.title, { description: c.description ?? e.message, duration: 8000 })
      return
    }
    toast.error(e.message)
    return
  }
  toast.error(fallback)
}

/** Show a Sonner toast once per distinct API error code while mounted. */
export function useQueryErrorToast(error: unknown | null, enabled = true) {
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled || !error) return
    const key = error instanceof ApiError ? `${error.code}:${error.message}` : String(error)
    if (last.current === key) return
    last.current = key
    toastFromApiError(error)
  }, [error, enabled])
}
