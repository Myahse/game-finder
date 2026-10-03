import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { playerDisplayLabel, reportLabels, timeAgo } from '../../lib/format'
import type { PublicUser, ReportType } from '../../lib/types'
import { Button, Card, Chip } from '../../components/ui'
import { Loading } from '../CourtPage'

interface Report {
  id: string
  type: ReportType
  description: string | null
  status: 'open' | 'resolved' | 'rejected'
  admin_note: string | null
  created_at: string
  court: { id: string; name: string; status: string }
  reporter: PublicUser | null
}

export function AdminReports() {
  const [status, setStatus] = useState<Report['status'] | null>('open')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => api<Report[]>(`/api/admin/reports${status ? `?status=${status}` : ''}`),
  })
  const act = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: Report['status']; note?: string }) =>
      api(`/api/admin/reports/${id}/resolve`, { method: 'POST', json: { status, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => alert(errorMessage(e)),
  })

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        {([null, 'open', 'resolved', 'rejected'] as const).map((s) => (
          <Chip key={s ?? 'all'} active={status === s} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </Chip>
        ))}
      </div>
      {isLoading && <Loading />}
      {data?.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              ⚑ {reportLabels[r.type]} ·{' '}
              <Link to={`/courts/${r.court.id}`} className="text-brand">
                {r.court.name}
              </Link>
            </p>
            {r.description && <p className="mt-1 text-sm">{r.description}</p>}
            <p className="mt-1 text-xs text-ink-2">
              {r.reporter ? playerDisplayLabel(r.reporter, true) : 'Deleted user'} · {timeAgo(r.created_at)} · {r.status}
              {r.admin_note && ` · note: ${r.admin_note}`}
            </p>
          </div>
          {r.status === 'open' ? (
            <div className="flex gap-2">
              <Button
                variant="live"
                className="min-h-9 px-3 text-base"
                onClick={() => act.mutate({ id: r.id, status: 'resolved', note: prompt('Note (optional)') ?? undefined })}
              >
                Resolve
              </Button>
              <Button variant="secondary" className="min-h-9 px-3 text-base" onClick={() => act.mutate({ id: r.id, status: 'rejected' })}>
                Reject
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="min-h-9 px-3 text-base" onClick={() => act.mutate({ id: r.id, status: 'open' })}>
              Reopen
            </Button>
          )}
        </Card>
      ))}
      {data?.length === 0 && <p className="p-6 text-center text-ink-2">Nothing to review. 🎉</p>}
    </div>
  )
}
