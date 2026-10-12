import { Check, CircleDashed, Clock, Globe, UserPlus, WifiOff } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import type { PublicUser } from '../../lib/types'
import { Avatar, Button, Skeleton } from '../../components/ui'
import { SportIcon } from '../../components/icons'
import { WhatsAppIcon } from '../../components/WhatsApp'
import { whatsappShareUrl } from '../../lib/whatsapp'
import { firstName } from '../../jeu/data'
import type { RoomLobby } from '../../jeu/snapshot'
import { sportWords } from '../../jeu/words'

/**
 * An online match before kick-off. Every spot must be a real player who is
 * online and ready: then the server counts down and starts. No AI teammates.
 */
export function RoomLobbyView({ code, room, problem, myId, people, courtName, members, onSeat, onReady }: {
  code: string
  room: RoomLobby | null
  problem: 'gone' | 'full' | null
  myId: string
  people: Record<string, PublicUser>
  courtName: string
  members: string[]
  onSeat: (k: number | null) => void
  onReady: (on: boolean) => void
}) {
  const { t } = useLocale()
  const tl = t.jeu.lobby
  if (problem) return <p className="p-6 text-center text-sm text-ink-2">{problem === 'full' ? t.jeu.match.full : t.jeu.match.gone}</p>
  if (!room) return <div className="grid gap-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>

  const words = sportWords(t, room.sport)
  const format = t.jeu.format.replace(/\{n\}/g, String(room.size))
  const mySeat = room.slots.indexOf(myId)
  const iReady = room.ready.includes(myId)
  const missing = room.slots.filter((s) => !s).length
  const watching = members.filter((m) => !room.slots.includes(m)).length
  const status = room.startIn !== null ? tl.starting.replace('{n}', String(room.startIn))
    : missing > 1 ? tl.waitPlayers.replace('{n}', String(missing)) : missing === 1 ? tl.waitPlayer : tl.waitReady
  const invite = `${tl.inviteText.replace('{sport}', words.name).replace('{format}', format).replace('{court}', courtName || '…').replace('{code}', code.toUpperCase())} ${location.origin}/jeu/match/${code}`

  const team = (side: 0 | 1) => (
    <div className="grid gap-1.5">
      <span className={`display text-xs font-extrabold uppercase tracking-wider ${side ? 'text-upcoming' : 'text-brand'}`}>{side ? 'B' : 'A'}</span>
      {room.slots.slice(side * room.size, side * room.size + room.size).map((id, j) => {
        const k = side * room.size + j, u = id ? people[id] : undefined, mine = id === myId
        const online = !!id && room.online.includes(id), ready = !!id && room.ready.includes(id)
        return (
          <button key={k} type="button" disabled={!!id && !mine} onClick={() => onSeat(mine ? null : k)}
            className={`flex min-h-14 items-center gap-2 rounded-xl border p-2 text-left disabled:opacity-100 ${mine ? 'border-brand bg-brand/10' : id ? 'border-line bg-surface-2' : 'border-dashed border-line bg-surface'}`}>
            {u ? <Avatar user={u} size={36} /> : id ? <span className="size-9 rounded-full bg-surface-2" /> : <UserPlus className="size-9 rounded-full bg-surface-2 p-2 text-ink-2" aria-hidden />}
            <span className="grid min-w-0 flex-1">
              <b className="truncate text-sm">{id ? (u ? firstName(u) : '…') : tl.free}</b>
              <small className="flex items-center gap-1 text-[11px] text-ink-2">
                {!id ? tl.take : !online ? <><WifiOff className="size-3" aria-hidden />{tl.away}</> : ready ? <><Check className="size-3 text-live" aria-hidden /><span className="text-live">{tl.isReady}</span></> : <><CircleDashed className="size-3" aria-hidden />{tl.notReady}</>}
                {id && id === room.host && <span>· {tl.host}</span>}
              </small>
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 pb-6 pt-1">
      <div className="grid gap-0.5">
        <span className="display inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[.14em] text-brand"><Globe className="size-3.5" aria-hidden />{courtName}</span>
        <h1 className="display flex items-center gap-2 text-2xl font-black uppercase leading-none"><SportIcon slug={room.sport} className="size-6 text-brand" />{tl.title.replace('{sport}', words.name).replace('{format}', format)}</h1>
        <span className="text-xs text-ink-2">{words.rule} · {t.jeu.match.code} <b className="tracking-[.14em] text-[var(--gold)]">{code.toUpperCase()}</b>{watching > 0 ? ` · ${tl.watching.replace('{n}', String(watching))}` : ''}</span>
      </div>
      <p className="rounded-xl bg-surface-2 p-2.5 text-xs text-ink-2">{tl.allReal} {tl.turn}</p>
      <div className="grid grid-cols-2 gap-3">{team(0)}{team(1)}</div>
      <div className={`display flex items-center justify-center gap-2 rounded-xl py-2 text-lg font-black uppercase ${room.startIn !== null ? 'bg-live/15 text-live' : 'text-ink-2'}`} aria-live="polite">
        <Clock className="size-5" aria-hidden />{status}
      </div>
      {mySeat >= 0 && (
        <Button variant={iReady ? 'secondary' : 'primary'} onClick={() => onReady(!iReady)}>
          {iReady ? <CircleDashed className="size-5" aria-hidden /> : <Check className="size-5" aria-hidden />}{iReady ? tl.notReady : tl.ready}
        </Button>
      )}
      <a href={whatsappShareUrl(invite)} target="_blank" rel="noopener noreferrer" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1fa855] text-base font-bold text-white">
        <WhatsAppIcon className="size-5" />{tl.invite}
      </a>
    </div>
  )
}
