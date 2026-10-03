import { api } from './api'

const KEY = 'ftg_friend_invite_token'

export function stashFriendInviteToken(token: string) {
  const t = token.trim()
  if (t) localStorage.setItem(KEY, t)
}

export function peekFriendInviteToken(): string | null {
  const t = localStorage.getItem(KEY)?.trim()
  return t || null
}

export function clearFriendInviteToken() {
  localStorage.removeItem(KEY)
}

export function friendInviteUrl(token: string) {
  return `${window.location.origin}/friend/${encodeURIComponent(token.trim())}`
}

/** Accept a stashed invite after password login (sign-up / Google pass token in the body). */
export async function acceptPendingFriendInvite(): Promise<boolean> {
  const token = peekFriendInviteToken()
  if (!token) return false
  try {
    await api(`/api/friend-invites/${encodeURIComponent(token)}/accept`, { method: 'POST' })
    clearFriendInviteToken()
    return true
  } catch {
    return false
  }
}

export function friendInviteTokenForAuth(): string | undefined {
  return peekFriendInviteToken() ?? undefined
}
