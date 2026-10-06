import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { unregisterWebPush } from './webPush'
import { useQueryClient } from '@tanstack/react-query'
import {
  api,
  bootstrapSession,
  currentRefreshToken,
  establishSession,
  exchangeSession,
  getSession,
  onSessionChange,
  setSession,
} from './api'
import { acceptPendingFriendInvite, clearFriendInviteToken, friendInviteTokenForAuth } from './friendInvite'
import type { Me } from './types'

interface AuthState {
  user: Me | null
  /** False until the first cookie session bootstrap finishes (avoids racing ws-ticket). */
  sessionReady: boolean
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
  const [sessionReady, setSessionReady] = useState(false)
  const qc = useQueryClient()

  useEffect(() => onSessionChange((s) => setUser(s?.user ?? null)), [])

  useEffect(() => {
    void bootstrapSession().finally(() => setSessionReady(true))
  }, [])

  const login = useCallback(async (loginId: string, password: string) => {
    const data = await exchangeSession('/api/auth/login', { login: loginId.trim(), password })
    await establishSession(data)
    await acceptPendingFriendInvite()
  }, [])

  const register = useCallback<AuthState['register']>(async (input) => {
    const friend_invite_token = input.friend_invite_token ?? friendInviteTokenForAuth()
    const data = await exchangeSession('/api/auth/register', { ...input, friend_invite_token })
    await establishSession(data)
    clearFriendInviteToken()
  }, [])

  const googleSignIn = useCallback(async (idToken: string, viaFirebase = false) => {
    const path = viaFirebase ? '/api/auth/firebase' : '/api/auth/google'
    const friend_invite_token = friendInviteTokenForAuth()
    const s = await exchangeSession(path, { id_token: idToken, friend_invite_token })
    await establishSession(s)
    clearFriendInviteToken()
    return !s.user.onboarded
  }, [])

  const logout = useCallback(async () => {
    const refresh_token = currentRefreshToken()
    await unregisterWebPush()
    await api('/api/auth/logout', { method: 'POST', json: refresh_token ? { refresh_token } : undefined }).catch(() => {})
    setSession(null)
    qc.clear()
  }, [qc])

  const updateUser = useCallback((u: Me) => {
    const s = getSession()
    if (s) setSession({ ...s, user: u })
  }, [])

  const value = useMemo(
    () => ({ user, sessionReady, login, register, googleSignIn, logout, updateUser }),
    [user, sessionReady, login, register, googleSignIn, logout, updateUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
