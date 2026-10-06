import { useEffect, useState } from 'react'
import { Crown, Download, Flame, Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { PlayerAvatarConfig } from '../avatar/schema'
import { useLocale } from '../i18n/LocaleProvider'
import { BADGE_ART, isNewBadge, levelTier, TIER_COLORS, useMyProgress, useUserProgress, type Badge, type Progress } from '../lib/progress'
import { renderSticker } from '../lib/stickers'
import { Button, Card, Spinner } from './ui'

const FALLBACK_ART = { emoji: '🏅', color: '#8a94a6' }

/** The signed-in player's progress (also announces newly earned badges). */
export function MyProgressCard({ avatar }: { avatar: PlayerAvatarConfig | null }) {
  const { t } = useLocale()
  const { data } = useMyProgress()
  const fresh = Array.isArray(data?.new_badges) ? data.new_badges.join(',') : ''
  useEffect(() => {
    if (!fresh) return
    for (const id of fresh.split(',')) toast.success(`${t.progress.newBadge} ${BADGE_ART[id]?.emoji ?? ''} ${t.progress.names[id] ?? id}`)
  }, [fresh, t.progress])
  if (!data) return <LoadingCard />
  if (!Array.isArray(data.badges)) return null
  return <ProgressView p={data} avatar={avatar} mine />
}

export function UserProgressCard({ userId, avatar }: { userId: string; avatar: PlayerAvatarConfig | null }) {
  const { data, isError } = useUserProgress(userId)
  if (isError) return null
  if (!data) return <LoadingCard />
  if (!Array.isArray(data.badges)) return null
  return <ProgressView p={data} avatar={avatar} mine={false} />
}

function LoadingCard() {
  return (
    <Card className="flex justify-center">
      <Spinner className="text-brand" />
    </Card>
  )
}

function ProgressView({ p, avatar, mine }: { p: Progress; avatar: PlayerAvatarConfig | null; mine: boolean }) {
  const { t } = useLocale()
  const [open, setOpen] = useState<Badge | null>(null)
  const tier = levelTier(p.level)
  const color = TIER_COLORS[tier]
  const span = Math.max(1, p.next_level_xp - p.level_xp)
  const pct = Math.min(100, ((p.xp - p.level_xp) / span) * 100)
  const earned = p.badges.filter((b) => b.earned_at)
  const s = p.streak

  return (
    <Card className="grid gap-4">
      {/* Level + XP */}
      <div className="flex items-center gap-4">
        <div className="relative flex size-20 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} ${pct}%, var(--surface-2) 0)` }}>
          <div className="flex size-16 flex-col items-center justify-center rounded-full bg-surface">
            <span className="display text-3xl font-extrabold leading-none">{p.level}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="display text-3xl font-extrabold leading-none" style={{ color }}>
            {t.progress.titles[tier]}
          </p>
          <p className="text-sm font-semibold">
            {t.progress.level.replace('{n}', String(p.level))} · {t.progress.xp.replace('{n}', String(p.xp))}
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="mt-1 text-xs text-ink-2">{t.progress.toNext.replace('{n}', String(p.next_level_xp - p.xp)).replace('{l}', String(p.level + 1))}</p>
        </div>
      </div>

      {/* Crowns */}
      {p.crowns.map((c) => (
        <div key={c.court_id} className="flex items-center gap-2 rounded-xl bg-amber-400/15 px-3 py-2 font-bold text-amber-700 dark:text-amber-300">
          <Crown className="size-5 shrink-0" aria-hidden fill="currentColor" />
          {t.progress.crown.replace('{court}', c.court_name)}
        </div>
      ))}

      {/* Streak + ratings */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold text-ink-2">{t.progress.streak}</p>
          <p className="display flex items-center gap-1 text-2xl font-extrabold">
            <Flame className={`size-6 ${s.current > 0 ? 'text-orange-500' : 'text-ink-2'}`} aria-hidden fill={s.current > 0 ? 'currentColor' : 'none'} />
            {s.current}
          </p>
          <p className="text-xs text-ink-2">
            {s.current === 0 ? (mine ? t.progress.noStreak : t.progress.best.replace('{n}', String(s.best))) : s.active_this_week ? t.progress.streakSafe : mine ? t.progress.streakRisk : t.progress.best.replace('{n}', String(s.best))}
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold text-ink-2">{t.progress.rating}</p>
          {p.ratings.length === 0 ? (
            <p className="mt-1 text-xs text-ink-2">{t.progress.unrated}</p>
          ) : (
            p.ratings.slice(0, 3).map((r) => (
              <p key={r.sport.id} className="leading-tight">
                <span className="display block text-2xl font-extrabold tabular-nums">{r.rating}</span>
                <span className="block truncate text-xs text-ink-2">{r.sport.name}</span>
              </p>
            ))
          )}
        </div>
      </div>

      {/* Badges */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="display text-xl font-bold">{t.progress.badges}</h3>
          <span className="text-xs font-semibold text-ink-2">{t.progress.earned.replace('{n}', String(earned.length)).replace('{total}', String(p.badges.length))}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {p.badges.map((b) => {
            const art = BADGE_ART[b.id] ?? FALLBACK_ART
            const got = !!b.earned_at
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setOpen(b)}
                className="flex flex-col items-center gap-1 rounded-xl p-1 text-center hover:bg-surface-2"
                aria-label={`${t.progress.names[b.id] ?? b.id}${got ? '' : ` (${t.progress.locked})`}`}
              >
                <span className="relative">
                  <span
                    className={`flex size-12 items-center justify-center rounded-full text-2xl ${got ? 'shadow-md' : 'opacity-40 grayscale'}`}
                    style={{ background: got ? art.color : 'var(--surface-2)', boxShadow: got ? `0 0 0 3px var(--surface), 0 0 0 5px ${art.color}55` : undefined }}
                  >
                    {art.emoji}
                  </span>
                  {got && isNewBadge(b) && <span className="absolute -right-1 -top-1 rounded-full bg-brand px-1 text-[9px] font-bold text-brand-ink">NEW</span>}
                </span>
                <span className={`line-clamp-2 text-[11px] font-semibold leading-tight ${got ? '' : 'text-ink-2'}`}>{t.progress.names[b.id] ?? b.id}</span>
                {!got && b.goal > 1 && (
                  <span className="text-[10px] text-ink-2">{t.progress.progress.replace('{have}', String(b.have)).replace('{goal}', String(b.goal))}</span>
                )}
              </button>
            )
          })}
        </div>
        {mine && <p className="mt-2 text-[11px] text-ink-2">{t.progress.xpHow}</p>}
      </div>
      {open && <BadgeSheet badge={open} avatar={avatar} canShare={mine && !!open.earned_at} onClose={() => setOpen(null)} />}
    </Card>
  )
}

function BadgeSheet({ badge, avatar, canShare, onClose }: { badge: Badge; avatar: PlayerAvatarConfig | null; canShare: boolean; onClose: () => void }) {
  const { t, locale } = useLocale()
  const art = BADGE_ART[badge.id] ?? FALLBACK_ART
  const name = t.progress.names[badge.id] ?? badge.id
  const [sticker, setSticker] = useState<{ blob: Blob; src: string } | null>(null)

  useEffect(() => {
    if (!canShare || !avatar) return
    let src = ''
    let cancelled = false
    renderSticker(avatar, { id: `badge-${badge.id}`, caption: name.toUpperCase(), expression: { eyes: 'happy', eyebrows: 'raisedExcitedNatural', mouth: 'smile' }, tilt: -4, medal: art })
      .then((blob) => {
        if (cancelled) return
        src = URL.createObjectURL(blob)
        setSticker({ blob, src })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [canShare, avatar, badge.id, name, art])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = `badge-${badge.id}.png`
  const save = () => {
    if (!sticker) return
    const a = document.createElement('a')
    a.href = sticker.src
    a.download = fileName
    a.click()
  }
  const share = async () => {
    if (!sticker) return
    const file = new File([sticker.blob], fileName, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
    save()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {sticker ? (
          <img src={sticker.src} alt="" className="ftg-av-pop mx-auto size-52 object-contain" />
        ) : (
          <span
            className={`ftg-av-pop mx-auto flex size-28 items-center justify-center rounded-full text-6xl ${badge.earned_at ? '' : 'opacity-40 grayscale'}`}
            style={{ background: badge.earned_at ? art.color : 'var(--surface-2)' }}
          >
            {art.emoji}
          </span>
        )}
        <h2 className="display mt-3 text-3xl font-extrabold">{name}</h2>
        <p className="text-ink-2">{t.progress.descs[badge.id]}</p>
        {badge.earned_at ? (
          <p className="mt-1 text-sm font-semibold text-live">
            {t.progress.unlockedOn.replace('{date}', new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(badge.earned_at)))}
          </p>
        ) : (
          badge.goal > 1 && (
            <div className="mx-auto mt-3 w-full max-w-60">
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (badge.have / badge.goal) * 100)}%`, background: art.color }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-ink-2">
                {t.progress.progress.replace('{have}', String(badge.have)).replace('{goal}', String(badge.goal))} · {t.progress.toGo.replace('{n}', String(Math.max(0, badge.goal - badge.have)))}
              </p>
            </div>
          )
        )}
        {(t.progress.how[badge.id]?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-left">
            <p className="mb-2 text-sm font-bold">{badge.earned_at ? t.progress.howDone : t.progress.howTitle}</p>
            <ol className="grid gap-1.5">
              {t.progress.how[badge.id].map((step, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: art.color }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {!badge.earned_at && <p className="mt-2 text-xs font-semibold text-brand">{t.progress.badgeXp}</p>}
          </div>
        )}
        {canShare && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => void share()} disabled={!sticker}>
              <Share2 className="size-5" aria-hidden /> {t.share.share}
            </Button>
            <Button type="button" variant="secondary" className="text-base" onClick={save} disabled={!sticker}>
              <Download className="size-5" aria-hidden /> {t.share.save}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
