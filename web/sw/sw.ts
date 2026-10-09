/// <reference lib="webworker" />
// Service worker: offline app shell (Workbox precache) + web push from FCM.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { notificationLink } from '../src/lib/notificationLinks'
import type { AppNotification } from '../src/lib/types'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/uploads\//] }))

type FcmPayload = {
  notification?: { title?: string; body?: string }
  data?: Record<string, string>
}

function linkFor(data: Record<string, string>): string {
  const type = (data.type ?? 'system') as AppNotification['type']
  return notificationLink({ type, data: data as AppNotification['data'] }) ?? '/notifications'
}

self.addEventListener('push', (event) => {
  let payload: FcmPayload = {}
  try {
    payload = (event.data?.json() ?? {}) as FcmPayload
  } catch {
    payload = { notification: { title: 'Out For Ground', body: event.data?.text() ?? '' } }
  }
  const data = payload.data ?? {}
  const title = payload.notification?.title || data.title || 'Out For Ground'
  const body = payload.notification?.body || data.body || ''
  event.waitUntil(
    (async () => {
      // The open app already shows a toast via its live connection.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (data.test !== '1' && windows.some((w) => w.visibilityState === 'visible')) return
      await self.registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: data.notification_id || undefined,
        data: { link: linkFor(data) },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data as { link?: string } | null)?.link ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          await w.focus()
          await w.navigate(link).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(link)
    })(),
  )
})
