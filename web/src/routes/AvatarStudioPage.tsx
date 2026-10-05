import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AvatarStudio } from '../avatar/studio/AvatarStudio'
import { parsePlayerAvatar } from '../avatar/resolve'
import { defaultConfig } from '../avatar/presets'
import type { PlayerAvatarConfig, SportSlug } from '../avatar/schema'
import { api } from '../lib/api'
import { useMySport } from '../lib/mySport'
import { PageHeader } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { Loading } from './CourtPage'

const SPORT_SLUGS: SportSlug[] = ['basketball', 'football', 'tennis', 'badminton', 'volleyball', 'running', 'gym']

export function AvatarStudioPage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const mySport = useMySport()
  const { data, isPending } = useQuery({
    queryKey: ['my-avatar'],
    queryFn: () => api<{ config: PlayerAvatarConfig | null }>('/api/me/avatar'),
  })
  // New players start dressed for their main sport.
  const base = SPORT_SLUGS.find((s) => s === mySport?.slug) ?? 'basketball'
  const initial = parsePlayerAvatar(data?.config) ?? defaultConfig(base)

  return (
    <div>
      {/* Wait for the saved avatar so editing starts from it, not from the default player. */}
      {isPending ? (
        <>
          <PageHeader title={t.avatarStudio.title} back="/profile" />
          <Loading />
        </>
      ) : (
        <AvatarStudio key={data?.config ? 'saved' : 'new'} initial={initial} onSaved={() => navigate('/profile')} />
      )}
    </div>
  )
}
