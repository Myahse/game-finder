import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../lib/api'
import { friendInviteUrl } from '../lib/friendInvite'
import { useFriendRequests, useFriends } from '../lib/queries'
import type { PublicUser } from '../lib/types'
import { Avatar, Button, Card, ErrorText, Field, Input } from './ui'

export function FriendsPanel() {
  const qc = useQueryClient()
  const { data: friends } = useFriends()
  const { data: requests } = useFriendRequests()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const send = useMutation({
    mutationFn: () => api('/api/me/friend-requests', { method: 'POST', json: { username: username.replace(/^@/, '').trim() } }),
    onSuccess: () => {
      setUsername('')
      setError('')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const copyInvite = useMutation({
    mutationFn: async () => {
      const r = await api<{ token: string }>('/api/me/friend-invite-link', { method: 'POST' })
      const url = friendInviteUrl(r.token)
      await navigator.clipboard.writeText(url)
      return url
    },
    onSuccess: () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api(`/api/me/friend-requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const incoming = requests?.incoming ?? []
  const outgoing = requests?.outgoing ?? []

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="display text-2xl font-bold">Friends</h2>
        <p className="mt-1 text-sm text-ink-2">Add players to invite them to games quickly.</p>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full sm:w-auto"
          loading={copyInvite.isPending}
          onClick={() => copyInvite.mutate()}
        >
          {copied ? 'Link copied!' : 'Copy invite link'}
        </Button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!username.trim()) return
          send.mutate()
        }}
      >
        <Input
          className="min-w-[10rem] flex-1"
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          list="ftg-friend-suggestions"
        />
        <Button type="submit" loading={send.isPending} disabled={!username.trim()}>
          Add friend
        </Button>
      </form>
      <datalist id="ftg-friend-suggestions">
        {friends?.map((f) => (
          <option key={f.id} value={f.username}>{f.first_name} {f.last_name}</option>
        ))}
      </datalist>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {incoming.length > 0 && (
        <Field label="Requests for you">
          <ul className="grid gap-2">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 p-2">
                <FriendLine user={r.user} />
                <div className="flex shrink-0 gap-1">
                  <Button type="button" className="min-h-9 px-3 text-sm" loading={respond.isPending} onClick={() => respond.mutate({ id: r.id, accept: true })}>
                    Accept
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => respond.mutate({ id: r.id, accept: false })}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {outgoing.length > 0 && (
        <p className="text-sm text-ink-2">
          Waiting: {outgoing.map((r) => `@${r.user.username}`).join(', ')}
        </p>
      )}

      <Field label={`Your friends (${friends?.length ?? 0})`}>
        {!friends?.length ? (
          <p className="text-sm text-ink-2">No friends yet — search by username above.</p>
        ) : (
          <ul className="grid gap-2">
            {friends.map((f) => (
              <li key={f.id} className="rounded-xl border border-line bg-surface-2 p-2">
                <FriendLine user={f} />
              </li>
            ))}
          </ul>
        )}
      </Field>
    </Card>
  )
}

function FriendLine({ user }: { user: PublicUser }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <Avatar user={user} size={36} />
      <span>
        {user.first_name} {user.last_name}
        <span className="block text-xs font-medium text-ink-2">@{user.username}</span>
      </span>
    </span>
  )
}
