import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { AvatarStudio } from '../avatar/studio/AvatarStudio'
import { parsePlayerAvatar } from '../avatar/resolve'
import { AVATAR_SPORTS, defaultConfig } from '../avatar/presets'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { api } from '../lib/api'
import { useMySport } from '../lib/mySport'
import { ScreenGuide } from '../components/ScreenGuide'
import { PageHeader } from '../components/ui'
import { useLocale } from '../i18n/LocaleProvider'
import { Loading } from './CourtPage'


export function AvatarStudioPage() {
  const navigate = useNavigate()
  // Straight after sign-up: friendlier title, Skip goes to the map, saving lands on the map.
  const welcome = useSearchParams()[0].get('welcome') === '1'
  const done = welcome ? '/' : '/profile'
  const { t } = useLocale()
  const mySport = useMySport()
  const { data, isPending } = useQuery({
    queryKey: ['my-avatar'],
    queryFn: () => api<{ config: PlayerAvatarConfig | null }>('/api/me/avatar'),
  })
  // New players start dressed for their main sport.
  const base = AVATAR_SPORTS.find((s) => s === mySport?.slug) ?? 'basketball'
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
        <AvatarStudio
          key={data?.config ? 'saved' : 'new'}
          initial={initial}
          back={done}
          skip={
            welcome ? (
              <Link to="/" replace className="px-2 text-sm font-semibold text-ink-2 hover:text-ink">
                {t.avatarStudio.skip}
              </Link>
            ) : undefined
          }
          onSaved={() => navigate(done, { replace: welcome })}
        />
      )}
      {!isPending && (
        <ScreenGuide screen="avatar" tips={[{ icon: UserRound, title: t.guide.avatarTitle, body: t.guide.avatarBody }]} />
      )}
    </div>
  )
}
