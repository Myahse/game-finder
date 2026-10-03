import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Bell, BellOff } from 'lucide-react'
import { SportName } from '../../components/icons'
import { Avatar, Button, Card, Input } from '../../components/ui'
import { Loading } from '../CourtPage'

interface AdminUser {
  id: string
  first_name: string
  last_name: string
  username: string
  email: string
  avatar_url: string | null
  role: 'user' | 'admin'
  suspended_at: string | null
  created_at: string
  preferred_sport_id: string | null
  preferred_sport_name: string | null
  preferred_sport_slug: string | null
  push_device_count: number
  stats: { games_played: number; games_created: number }
}

export function AdminUsers() {
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: () => api<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`),
  })
  const act = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'suspend' | 'unsuspend' | 'delete' }) =>
      kind === 'delete'
        ? api(`/api/admin/users/${id}`, { method: 'DELETE' })
        : api(`/api/admin/users/${id}/suspend`, { method: 'POST', json: { suspended: kind === 'suspend' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => alert(errorMessage(e)),
  })

  return (
    <div className="grid gap-3">
      <Input placeholder="Search name, username or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <Loading />}
      {data?.map((u) => (
        <Card key={u.id} className={`flex flex-wrap items-center gap-3 ${u.suspended_at ? 'opacity-60' : ''}`}>
          <Avatar user={u} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {u.first_name} {u.last_name} <span className="font-normal text-ink-2">@{u.username}</span>
              {u.role === 'admin' && <span className="ml-2 rounded bg-brand/15 px-1.5 text-xs font-bold text-brand">ADMIN</span>}
              {u.suspended_at && <span className="ml-2 rounded bg-danger/15 px-1.5 text-xs font-bold text-danger">SUSPENDED</span>}
            </p>
            <p className="truncate text-sm text-ink-2">{u.email}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
              <span>
                Sport:{' '}
                {u.preferred_sport_slug && u.preferred_sport_name ? (
                  <SportName sport={{ name: u.preferred_sport_name, slug: u.preferred_sport_slug }} />
                ) : (
                  <span className="text-ink-2/80">Not set</span>
                )}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                {u.push_device_count > 0 ? (
                  <>
                    <Bell className="size-3.5 text-live" aria-hidden />
                    Push on ({u.push_device_count} device{u.push_device_count === 1 ? '' : 's'})
                  </>
                ) : (
                  <>
                    <BellOff className="size-3.5 opacity-50" aria-hidden />
                    Push off
                  </>
                )}
              </span>
              <span aria-hidden>·</span>
              <span>
                Joined {new Date(u.created_at).toLocaleDateString()} · {u.stats.games_played} played · {u.stats.games_created} created
              </span>
            </p>
          </div>
          {u.id !== me?.id && (
            <>
              <Button
                variant={u.suspended_at ? 'secondary' : 'danger'}
                className="min-h-9 px-3 text-base"
                onClick={() => act.mutate({ id: u.id, kind: u.suspended_at ? 'unsuspend' : 'suspend' })}
              >
                {u.suspended_at ? 'Unsuspend' : 'Suspend'}
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 px-3 text-base"
                onClick={() => confirm(`Delete @${u.username} and all their data?`) && act.mutate({ id: u.id, kind: 'delete' })}
              >
                Delete
              </Button>
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
