import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ApiError, apiErrorText } from './api'
import { currentT } from '../i18n/LocaleProvider'

type Copy = { title: string; description?: string }

export function toastFromApiError(e: unknown, fallback?: string) {
  const t = currentT().errors
  if (e instanceof ApiError) {
    const c = (t.toast as Record<string, Copy | undefined>)[e.code]
    if (c) {
      toast.error(c.title, { description: c.description ?? apiErrorText(e), duration: 8000 })
      return
    }
    toast.error(apiErrorText(e))
    return
  }
  toast.error(fallback ?? (e instanceof TypeError ? t.network : t.generic))
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
