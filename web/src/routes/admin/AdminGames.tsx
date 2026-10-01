import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { dayAndClock, gameTypeLabels } from '../../lib/format'
import type { Game, GameStatus } from '../../lib/types'
import { SportName } from '../../components/icons'
import { Button, Card, Chip } from '../../components/ui'
import { Loading } from '../CourtPage'

export function AdminGames() {
  const [status, setStatus] = useState<GameStatus | null>('active')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'games', status],
    queryFn: () => api<Game[]>(`/api/admin/games${status ? `?status=${status}` : ''}`),
  })
  const act = useMutation({
    mutationFn: ({ id, kind, reason }: { id: string; kind: 'cancel' | 'delete'; reason?: string }) =>
      kind === 'cancel'
        ? api(`/api/admin/games/${id}/cancel`, { method: 'POST', json: { reason } })
        : api(`/api/admin/games/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => alert(errorMessage(e)),
  })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {([null, 'active', 'scheduled', 'completed', 'cancelled'] as const).map((s) => (
          <Chip key={s ?? 'all'} active={status === s} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </Chip>
        ))}
      </div>
      {isLoading && <Loading />}
      {data?.map((g) => (
        <Card key={g.id} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Link to={`/games/${g.id}`} className="font-semibold hover:text-brand">
              <SportName sport={g.sport} />
              {gameTypeLabels[g.game_type]} · {g.court.name}
            </Link>
            <p className="text-sm text-ink-2">
              {g.status.toUpperCase()} · {dayAndClock(g.start_time)} · {g.player_count}/{g.max_players} players
              {g.creator && ` · by @${g.creator.username}`}
            </p>
          </div>
          {(g.status === 'active' || g.status === 'scheduled') && (
            <Button
              variant="danger"
              className="min-h-9 px-3 text-base"
              onClick={() => {
                const reason = prompt('Reason (shown to players)')
                if (reason !== null) act.mutate({ id: g.id, kind: 'cancel', reason })
              }}
            >
              Cancel
            </Button>
          )}
          <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => confirm('Delete this game permanently?') && act.mutate({ id: g.id, kind: 'delete' })}>
            Delete
          </Button>
        </Card>
      ))}
      {data?.length === 0 && <p className="p-6 text-center text-ink-2">No games.</p>}
    </div>
  )
}
