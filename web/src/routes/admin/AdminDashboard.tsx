import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui'
import { Loading } from '../CourtPage'

interface Stats {
  total_users: number
  active_users: number
  active_now: number
  courts: number
  pending_courts: number
  games: number
  games_today: number
  active_games: number
  open_reports: number
  most_active_courts: { id: string; name: string; visits: number }[]
}

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api<Stats>('/api/admin/stats'),
    refetchInterval: 30_000,
  })
  if (isLoading || !data) return <Loading />
  const max = Math.max(1, ...data.most_active_courts.map((c) => c.visits))

  const tiles: [string, number, string?][] = [
    ['Total users', data.total_users],
    ['Active users (7d)', data.active_users],
    ['Playing right now', data.active_now],
    ['Courts', data.courts],
    ['Games', data.games],
    ['Games today', data.games_today],
    ['Active games', data.active_games],
    ['Pending courts', data.pending_courts, '/admin/courts?status=pending'],
    ['Open reports', data.open_reports, '/admin/reports'],
  ]

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value, link]) => {
          const body = (
            <Card className={link && value ? 'border-brand/50' : ''}>
              <p className="text-xs font-semibold uppercase text-ink-2">{label}</p>
              <p className="display mt-1 text-5xl font-extrabold tabular-nums">{value}</p>
            </Card>
          )
          return link ? (
            <Link key={label} to={link}>
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          )
        })}
      </div>
      <Card>
        <h2 className="display mb-3 text-2xl font-bold">Most active courts · 30 days</h2>
        {data.most_active_courts.length === 0 && <p className="text-sm text-ink-2">No activity yet.</p>}
        <ol className="grid gap-2">
          {data.most_active_courts.map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
              <div>
                <p className="font-semibold">{c.name}</p>
                <div className="mt-1 h-2 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(c.visits / max) * 100}%` }} />
                </div>
              </div>
              <span className="tabular-nums text-ink-2">{c.visits} check-ins & joins</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
