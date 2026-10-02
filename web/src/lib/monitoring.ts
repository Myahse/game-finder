/** Lightweight client error hooks. Wire Sentry later via VITE_SENTRY_DSN if needed. */

export function initMonitoring() {
  if (typeof window === 'undefined') return

  const log = (label: string, detail: unknown) => {
    if (import.meta.env.DEV) console.error(label, detail)
    // Optional: forward to Sentry / your API when VITE_SENTRY_DSN is set.
  }

  window.addEventListener('error', (ev) => {
    log('[ftg] uncaught', ev.error ?? ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    log('[ftg] unhandled rejection', ev.reason)
  })
}
