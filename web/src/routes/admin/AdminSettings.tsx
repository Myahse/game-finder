import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../lib/api'
import { Button, Card, ErrorText, Input } from '../../components/ui'
import { Loading } from '../CourtPage'

interface Setting {
  key: string
  value: number
  description: string
}

/** Tunables like presence duration — changed live, no deploy. */
export function AdminSettings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Setting[]>('/api/admin/settings') })
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () =>
      api<Setting[]>('/api/admin/settings', {
        method: 'PATCH',
        json: Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])),
      }),
    onSuccess: (s) => {
      qc.setQueryData(['admin', 'settings'], s)
      setDraft({})
      setError('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (isLoading || !data) return <Loading />
  return (
    <div className="mx-auto grid max-w-xl gap-3">
      {data.map((s) => (
        <Card key={s.key} className="flex items-center gap-4">
          <div className="flex-1">
            <p className="font-mono text-sm font-semibold">{s.key}</p>
            <p className="text-sm text-ink-2">{s.description}</p>
          </div>
          <Input
            type="number"
            min={0}
            className="w-24 text-right"
            value={draft[s.key] ?? String(s.value)}
            onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
          />
        </Card>
      ))}
      <ErrorText>{error}</ErrorText>
      <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!Object.keys(draft).length}>
        Save settings
      </Button>
    </div>
  )
}
