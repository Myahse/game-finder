import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getSession, onSessionChange, setSession } from './api'
import { acceptPendingFriendInvite, clearFriendInviteToken, friendInviteTokenForAuth } from './friendInvite'
import type { Me, Session } from './types'

interface AuthState {
  user: Me | null
  login: (login: string, password: string) => Promise<void>
  register: (input: {
    first_name: string
    last_name: string
    username: string
    email: string
    password: string
    avatar_url?: string
    friend_invite_token?: string
  }) => Promise<void>
  /** Exchange a Google / Firebase ID token for a session; returns true for a new account. */
  googleSignIn: (idToken: string, viaFirebase?: boolean) => Promise<boolean>
  logout: () => Promise<void>
  updateUser: (u: Me) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(() => getSession()?.user ?? null)
  const qc = useQueryClient()

  useEffect(() => onSessionChange((s) => setUser(s?.user ?? null)), [])

  // Refresh the cached profile once on load (role/suspension may have changed).
  useEffect(() => {
    if (!getSession()) return
    api<Me>('/api/me')
      .then((me) => {
        const s = getSession()
        if (s) setSession({ ...s, user: me })
      })
      .catch(() => {})
  }, [])

  const login = useCallback(async (loginId: string, password: string) => {
    setSession(
      await api<Session>('/api/auth/login', {
        method: 'POST',
        json: { login: loginId.trim(), password },
      }),
    )
    await acceptPendingFriendInvite()
  }, [])

  const register = useCallback<AuthState['register']>(async (input) => {
    const friend_invite_token = input.friend_invite_token ?? friendInviteTokenForAuth()
    setSession(
      await api<Session>('/api/auth/register', {
        method: 'POST',
        json: { ...input, friend_invite_token },
      }),
    )
    clearFriendInviteToken()
  }, [])

  const googleSignIn = useCallback(async (idToken: string, viaFirebase = false) => {
    const path = viaFirebase ? '/api/auth/firebase' : '/api/auth/google'
    const friend_invite_token = friendInviteTokenForAuth()
    const s = await api<Session>(path, {
      method: 'POST',
      json: { id_token: idToken, friend_invite_token },
    })
    setSession(s)
    clearFriendInviteToken()
    return !s.user.onboarded
  }, [])

  const logout = useCallback(async () => {
    const s = getSession()
    if (s) await api('/api/auth/logout', { method: 'POST', json: { refresh_token: s.refresh_token } }).catch(() => {})
    setSession(null)
    qc.clear()
  }, [qc])

  const updateUser = useCallback((u: Me) => {
    const s = getSession()
    if (s) setSession({ ...s, user: u })
  }, [])

  const value = useMemo(
    () => ({ user, login, register, googleSignIn, logout, updateUser }),
    [user, login, register, googleSignIn, logout, updateUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
