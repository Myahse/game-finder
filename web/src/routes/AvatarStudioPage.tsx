import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { AvatarStudio } from '../avatar/studio/AvatarStudio'
import { parsePlayerAvatar } from '../avatar/resolve'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { api } from '../lib/api'
import { PageHeader } from '../components/ui'

export function AvatarStudioPage() {
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['my-avatar'],
    queryFn: () => api<{ config: PlayerAvatarConfig | null }>('/api/me/avatar'),
  })
  const initial = parsePlayerAvatar(data?.config) ?? undefined

  return (
    <div className="pb-8">
      <PageHeader title="Avatar" back="/profile" right={<Link to="/profile" className="text-sm font-semibold text-brand">Done</Link>} />
      <AvatarStudio initial={initial} onSaved={() => navigate('/profile')} />
    </div>
  )
}
