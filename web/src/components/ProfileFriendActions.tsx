import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useFriendRequests, useFriends } from '../lib/queries'
import { playerDisplayLabel } from '../lib/format'
import type { PublicUser } from '../lib/types'
import { Button, ErrorText } from './ui'
import { useLocale } from '../i18n/LocaleProvider'
import { buzz, sparkle } from '../lib/fx'

type Relation = 'self' | 'guest' | 'friends' | 'incoming' | 'outgoing' | 'none'

function useRelation(target: PublicUser): { relation: Relation; incomingId?: string } {
  const { user } = useAuth()
  const { data: friends } = useFriends(!!user)
  const { data: requests } = useFriendRequests(!!user)

  return useMemo(() => {
    if (!user) return { relation: 'guest' }
    if (user.id === target.id) return { relation: 'self' }
    if (friends?.some((f) => f.id === target.id)) return { relation: 'friends' }
    const incoming = requests?.incoming.find((r) => r.user.id === target.id)
    if (incoming) return { relation: 'incoming', incomingId: incoming.id }
    if (requests?.outgoing.some((r) => r.user.id === target.id)) return { relation: 'outgoing' }
    return { relation: 'none' }
  }, [user, friends, requests, target.id])
}

export function ProfileFriendActions({ user, viewerIsAdmin = false }: { user: PublicUser; viewerIsAdmin?: boolean }) {
  const qc = useQueryClient()
  const { t } = useLocale()
  const f = t.account.friends
  const { relation, incomingId } = useRelation(user)
  const [error, setError] = useState('')

  const send = useMutation({
    mutationFn: () => api('/api/me/friend-requests', { method: 'POST', json: { username: user.username } }),
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean; from?: Element }) =>
      api(`/api/me/friend-requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }),
    onSuccess: (_, { accept, from }) => {
      if (accept && from) {
        sparkle(from, 22, ['#ef2b54', '#ff5a1f', '#f2b632', '#16a34a'])
        buzz([12, 40, 20])
      }
      setError('')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (relation === 'self') return null

  return (
    <div className="grid gap-2">
      {relation === 'guest' ? (
        <p className="text-center text-sm text-ink-2">
          <Link to="/?login=1" className="font-semibold text-brand">{f.guestLogIn}</Link>{f.guestToAdd.replace('{name}', playerDisplayLabel(user, viewerIsAdmin))}
        </p>
      ) : relation === 'friends' ? (
        <p className="rounded-xl bg-surface-2 py-2 text-center text-sm font-semibold text-brand">{f.title}</p>
      ) : relation === 'outgoing' ? (
        <p className="text-center text-sm text-ink-2">{f.requestSent}</p>
      ) : relation === 'incoming' && incomingId ? (
        <div className="flex gap-2">
          <Button type="button" className="flex-1" loading={respond.isPending} onClick={(e) => respond.mutate({ from: e.currentTarget, id: incomingId, accept: true })}>
            {t.account.friendInvite.accept}
          </Button>
          <Button type="button" variant="ghost" className="flex-1" onClick={() => respond.mutate({ id: incomingId, accept: false })}>
            {f.decline}
          </Button>
        </div>
      ) : (
        <Button type="button" loading={send.isPending} onClick={() => send.mutate()}>
          {f.addFriend}
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
