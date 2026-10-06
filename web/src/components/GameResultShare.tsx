import { useEffect, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'
import { playerAvatarForUser } from '../avatar/resolve'
import { useLocale } from '../i18n/LocaleProvider'
import { renderResultCard, type ResultPlayer } from '../lib/gameResultCard'
import { createGameShareUrl } from '../lib/gameShare'
import { topPerformers, type Scoreboard } from '../lib/scoreboard'
import type { Game } from '../lib/types'
import { Button, Spinner } from './ui'

/** "Share result": the scoreboard as an image card + link to the game. */
export function ShareResultButton({ game, sb }: { game: Game; sb: Scoreboard }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Share2 className="size-5" aria-hidden /> {t.scoreboard.shareResult}
      </Button>
      {open && <ResultSheet game={game} sb={sb} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Short share link while the game is open; afterwards the in-app game link. */
async function resultUrl(game: Game) {
  if (game.status === 'scheduled' || game.status === 'active') {
    try {
      return await createGameShareUrl(game.id)
    } catch {
      // fall through
    }
  }
  return `${window.location.origin}/games/${game.id}`
}

function ResultSheet({ game, sb, onClose }: { game: Game; sb: Scoreboard; onClose: () => void }) {
  const { t, locale } = useLocale()
  const [card, setCard] = useState<{ blob: Blob; src: string; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let src = ''
    let cancelled = false
    const byId = new Map((game.players ?? []).map((p) => [p.id, p]))
    const top = topPerformers(sb, 3)
    if (sb.mvp_user_id && !top.some((p) => p.userId === sb.mvp_user_id)) top.unshift({ userId: sb.mvp_user_id, value: sb.stats[sb.mvp_user_id]?.[sb.stat_keys[0]] ?? 0 })
    const players: ResultPlayer[] = top
      .slice(0, 3)
      .map((p) => ({ p, u: byId.get(p.userId) }))
      .filter((x) => !!x.u)
      .map(({ p, u }) => ({ username: u!.username, avatar: playerAvatarForUser(u!), value: p.value, mvp: p.userId === sb.mvp_user_id }))
    const dateLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(game.start_time))
    ;(async () => {
      const url = await resultUrl(game)
      const blob = await renderResultCard({
        url,
        sportName: game.sport.name,
        courtName: game.court.name,
        dateLabel,
        teams: sb.teams,
        winnerPosition: sb.winner_position,
        top: players,
        labels: {
          winner: t.scoreboard.winner,
          draw: t.scoreboard.draw,
          mvp: t.scoreboard.mvp,
          topPlayers: t.scoreboard.topPlayers,
          stat: t.scoreboard.statLabels[sb.stat_keys[0]] ?? '',
          scan: t.scoreboard.scan,
        },
      })
      if (cancelled) return
      src = URL.createObjectURL(blob)
      setCard({ blob, src, url })
    })().catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (src) URL.revokeObjectURL(src)
    }
  }, [game, sb, locale, t.scoreboard])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fileName = `find-the-game-result-${game.id.slice(0, 8)}.png`

  const save = () => {
    if (!card) return
    const a = document.createElement('a')
    a.href = card.src
    a.download = fileName
    a.click()
  }

  const share = async () => {
    if (!card) return
    const file = new File([card.blob], fileName, { type: 'image/png' })
    const text = `${t.scoreboard.resultText} ${card.url}`
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t.scoreboard.resultTitle, text })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: t.scoreboard.resultTitle, text: t.scoreboard.resultText, url: card.url })
        return
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
    save()
  }

  return (
    <div className="ftg-safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t.scoreboard.resultTitle} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl font-extrabold">{t.scoreboard.resultTitle}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={t.common.close}>
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mx-auto flex aspect-[4/5] w-full max-w-[17rem] items-center justify-center overflow-hidden rounded-2xl bg-surface-2">
          {card ? <img src={card.src} alt={t.scoreboard.preview} className="h-full w-full object-cover" /> : failed ? <p className="p-4 text-center text-sm text-ink-2">{t.share.failed}</p> : <Spinner className="text-brand" />}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => void share()} disabled={!card}>
            <Share2 className="size-5" aria-hidden /> {t.share.share}
          </Button>
          <Button type="button" variant="secondary" className="text-base" onClick={save} disabled={!card}>
            <Download className="size-5" aria-hidden /> {t.share.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
