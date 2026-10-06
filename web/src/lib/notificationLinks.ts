import type { AppNotification } from './types'

export type NotificationLinkInput = Pick<AppNotification, 'type' | 'data'>

export function notificationLink(n: NotificationLinkInput): string | undefined {
  if (n.type === 'admin_court_request' && n.data.court_id) return `/admin/courts/${n.data.court_id}`
  if (n.type === 'court_pending_review' && n.data.court_id) return `/courts/${n.data.court_id}`
  if (n.type === 'admin_new_user') return '/admin/users'
  if (n.type === 'friend_request') return '/profile'
  if (n.type === 'challenge') return '/challenges'
  if (n.type === 'achievement' && n.data.kind === 'king' && n.data.court_id) return `/courts/${n.data.court_id}`
  if (n.type === 'achievement') return '/profile'
  if (n.data.game_id) return `/games/${n.data.game_id}`
  if (n.data.court_id) return `/?court=${n.data.court_id}`
  if (n.data.user_id) return `/users/${n.data.user_id}`
  return undefined
}
