import { useState, type FormEvent } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'
import { useAuth } from '../lib/auth'
import { playerDisplayLabel } from '../lib/format'
import { useFriends } from '../lib/queries'
import { Button, Input } from './ui'

type Props = {
  gameId: string
}

/** Invite by picking a friend or typing any @username. */
export function GameInviteField({ gameId }: Props) {
  const { user } = useAuth()
  const viewerIsAdmin = user?.role === 'admin'
  const { data: friends } = useFriends()
  const [username, setUsername] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pickFriend = (u: string) => {
    setUsername(u)
    setMsg('')
    setError('')
    setNotFound(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const u = username.replace(/^@/, '').trim()
    if (!u) return
    setBusy(true)
    setError('')
    setMsg('')
    setNotFound(null)
    try {
      await api(`/api/games/${gameId}/invite`, { method: 'POST', json: { username: u } })
      setMsg(`Invited @${u} — they'll get a notification.`)
      setUsername('')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'user_not_found') {
        setNotFound(err.message)
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {friends && friends.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {friends.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => pickFriend(f.username)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold hover:border-brand hover:bg-brand/10"
            >
              {playerDisplayLabel(f, viewerIsAdmin)}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2">
        <Input
          placeholder="Invite by @username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          list="ftg-invite-friends"
          required
          className="min-w-[12rem] flex-1"
        />
        <datalist id="ftg-invite-friends">
          {friends?.map((f) => (
            <option key={f.id} value={f.username}>{playerDisplayLabel(f, viewerIsAdmin)}</option>
          ))}
        </datalist>
        <Button type="submit" variant="secondary" loading={busy}>
          Invite
        </Button>
        {msg && <p className="w-full text-sm text-live">{msg}</p>}
        {error && <p className="w-full text-sm text-danger">{error}</p>}
        {notFound && <p className="w-full text-sm text-danger">{notFound}</p>}
      </form>
    </>
  )
}
