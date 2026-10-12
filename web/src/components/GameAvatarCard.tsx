import { Link } from 'react-router-dom'
import { ChevronRight, Gamepad2 } from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import { useJeuMe } from '../jeu/data'

/** Profile entry to Mode Jeu: the player's game avatar, its OVR and level. */
export function GameAvatarCard() {
  const { t } = useLocale()
  const { data } = useJeuMe()
  return (
    <Link
      to="/jeu/avatar"
      state={{ from: '/profile' }}
      className="ftg-press flex items-center gap-3 rounded-2xl bg-[#11161e] p-4 text-white ring-1 ring-brand"
    >
      <Gamepad2 className="size-7 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="display block text-lg font-extrabold uppercase leading-tight">{t.jeu.entry.profile}</b>
        <span className="text-sm text-white/70">
          {data ? t.jeu.entry.profileSub.replace('{ovr}', String(data.ovr)).replace('{level}', String(data.progress.level)) : t.jeu.entry.courtSub}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-white/60" aria-hidden />
    </Link>
  )
}
