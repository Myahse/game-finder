import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, Crown, Globe, MapPin, Play, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '../../i18n/LocaleProvider'
import { Avatar, Button, Skeleton } from '../../components/ui'
import { ApiError } from '../../lib/api'
import type { PublicUser } from '../../lib/types'
import { SportIcon } from '../../components/icons'
import { SIZES, botRoster, createRoom, firstName, odds, rosterOf, useArena, useGamePlayers, type GamePlayer } from '../../jeu/data'
import { SPORTS, type RosterEntry, type Sport } from '../../jeu/engine'
import { sportWords } from '../../jeu/words'
import { setPendingMatch } from '../../jeu/session'
import { useLobby } from './JeuLayout'

type Pickable = { r: RosterEntry; user: PublicUser | null; pos: string }

function PlayerFace({ p, size = 44 }: { p: Pickable; size?: number }) {
  if (p.user) return <Avatar user={p.user} size={size} />
  return (
    <span className="display inline-grid shrink-0 place-items-center rounded-full bg-surface-2 font-black text-ink-2" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {p.r.name.slice(0, 1)}
    </span>
  )
}

const ovrOf = (r: RosterEntry) => Math.round((r.a.tir + r.a.pen + r.a.col + r.a.def + r.a.end + r.a.men) / 6)

/** A court as an arena: the team to beat, your team, and online matches here. */
export function JeuArenaPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useLocale()
  const tj = t.jeu, ta = tj.arena
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const asked = params.get('sport')
  const sport: Sport = SPORTS.find((s) => s === asked) ?? 'basketball'
  const { data, isLoading, error } = useArena(id, sport)
  const lobby = useLobby()
  const rooms = lobby.rooms.filter((r) => r.court_id === id)
  const hostsQ = useGamePlayers(rooms.map((r) => r.host_id))
  const [picks, setPicks] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [sizeFor, setSizeFor] = useState<Partial<Record<Sport, number>>>({})
  const size = sizeFor[sport] ?? SIZES[sport][0]
  const words = sportWords(t, sport)
  const courtSports = data?.court.sports ?? []
  const pickSport = (s: Sport) => { setPicks(null); setParams((p) => { p.set('sport', s); return p }, { replace: true }) }
  // A court without basketball opens on its first Mode Jeu sport.
  useEffect(() => {
    if (!asked && courtSports.length && !courtSports.includes('basketball')) pickSport(courtSports[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, courtSports.join()])

  const view = useMemo(() => {
    if (!data) return null
    const toP = (g: GamePlayer): Pickable => ({ r: rosterOf(g), user: g.user, pos: '' })
    const me = toP(data.me)
    const friends = data.friends.map(toP)
    const bench = [...friends]
    for (let i = 1; bench.length < 2; i++) bench.push({ r: botRoster(i, ta.bot), user: null, pos: '' })
    return { me, bench }
  }, [data, ta.bot])

  if (isLoading || !view || !data) {
    if (error) return <p className="p-6 text-center text-sm text-ink-2">{t.jeu.match.gone}</p>
    return <div className="grid gap-3 p-4"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-24" /></div>
  }

  const mates = size - 1
  const chosen = (picks ?? view.bench.map((p) => p.r.id)).slice(0, mates)
  const teamA = [view.me, ...view.bench.filter((p) => chosen.includes(p.r.id))].slice(0, size)
  const taken = new Set(teamA.map((p) => p.r.id))
  const rivals: Pickable[] = data.rivals.filter((g) => !taken.has(g.user.id)).map((g) => ({ r: rosterOf(g), user: g.user, pos: '' }))
  for (let i = 4; rivals.length < size; i++) rivals.push({ r: botRoster(i, ta.bot, 3), user: null, pos: '' })
  const teamB = rivals.slice(0, size)
  const o = odds(teamA.map((p) => p.r), teamB.map((p) => p.r))
  const ready = teamA.length === size
  const king = data.king_id ? data.rivals.find((g) => g.user.id === data.king_id) : null
  const nameB = teamB[0].r.name

  const toggle = (rid: string) => setPicks(chosen.includes(rid) ? chosen.filter((x) => x !== rid) : chosen.length < mates ? [...chosen, rid] : [...chosen.slice(0, mates - 1), rid])
  const users = Object.fromEntries([...teamA, ...teamB].filter((p) => p.user).map((p) => [p.r.id, p.user!]))
  const court = { id: data.court.id, name: data.court.name }
  const teams: [RosterEntry[], RosterEntry[]] = [teamA.map((p) => p.r), teamB.map((p) => p.r)]

  const playSolo = () => { setPendingMatch({ mode: 'solo', sport, court, teams, users }); navigate('/jeu/match') }
  const playOnline = async () => {
    setBusy(true)
    try {
      const room = await createRoom(court.id, sport, size)
      setPendingMatch(null)
      navigate(`/jeu/match/${room.code}`)
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 401 ? tj.match.signIn : tj.match.createFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 pb-6 pt-1">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <span className="display text-xs font-extrabold uppercase tracking-[.14em] text-brand">{ta.title}</span>
          <h1 className="display truncate text-3xl font-black uppercase leading-none">{data.court.name}</h1>
        </div>
        <span className="display inline-flex shrink-0 items-center gap-1 rounded-full bg-live/15 px-2.5 py-1 text-sm font-bold text-live">
          <Users className="size-4" aria-hidden />{tj.arenas.players.replace('{n}', String(data.court.players_here))}
        </span>
      </div>

      {courtSports.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist">
          {courtSports.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={s === sport} onClick={() => pickSport(s)}
              className={`display inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-extrabold uppercase ${s === sport ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2'}`}>
              <SportIcon slug={s} className="size-4" />{t.jeu.sports[s]}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="display inline-flex items-center gap-1.5 text-sm font-extrabold uppercase text-ink-2"><SportIcon slug={sport} className="size-4 text-brand" />{words.name} · {words.rule}</span>
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {SIZES[sport].map((n) => (
            <button key={n} type="button" aria-pressed={n === size} onClick={() => { setSizeFor((x) => ({ ...x, [sport]: n })); setPicks(null) }}
              className={`display rounded-lg px-2.5 py-1 text-xs font-extrabold uppercase ${n === size ? 'bg-brand text-white' : 'text-ink-2'}`}>
              {t.jeu.format.replace(/\{n\}/g, String(n))}
            </button>
          ))}
        </div>
      </div>

      <section className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/50 bg-surface p-3">
        <Crown className="size-7 shrink-0 text-[var(--gold)]" aria-hidden />
        {king ? (
          <>
            <Avatar user={king.user} size={40} />
            <div className="min-w-0">
              <b className="block truncate">{ta.king} : {firstName(king.user)}</b>
              <span className="text-xs text-ink-2">{ta.ovr.replace('{n}', String(king.ovr))}</span>
            </div>
          </>
        ) : (
          <span className="text-sm text-ink-2">{ta.kingNone}</span>
        )}
      </section>

      {mates === 0 ? <p className="text-sm text-ink-2">{t.jeu.solo1}</p> : <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="display text-sm font-extrabold uppercase tracking-wider text-ink-2">{mates === 1 ? t.jeu.pick1 : t.jeu.pickN.replace('{n}', String(mates))}</span>
          <span className="display text-sm font-bold">{ta.picked.replace('{n}', String(chosen.length)).replace('{max}', String(mates))}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {view.bench.slice(0, 8).map((p) => {
            const on = chosen.includes(p.r.id)
            return (
              <button key={p.r.id} type="button" onClick={() => toggle(p.r.id)} aria-pressed={on}
                className={`relative grid justify-items-center gap-1 rounded-xl border p-2 text-center text-xs font-semibold ${on ? 'border-brand bg-brand/10' : 'border-line bg-surface-2'}`}>
                {on && <Check className="absolute right-1 top-1 size-3.5 text-brand" aria-hidden />}
                <PlayerFace p={p} size={40} />
                <span className="w-full truncate">{p.r.name}</span>
                <small className="text-[10px] text-ink-2">{ta.ovr.replace('{n}', String(ovrOf(p.r)))}</small>
              </button>
            )
          })}
        </div>
        {data.friends.length < mates && <p className="text-xs text-ink-2">{ta.friendsEmpty}</p>}
      </section>}

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamCol title={ta.team.replace('{name}', view.me.r.name)} sub={ta.ovr.replace('{n}', String(o.oa))} players={teamA} />
          <span className="display text-3xl font-black italic text-brand">VS</span>
          <TeamCol title={ta.team.replace('{name}', nameB)} sub={ta.ovr.replace('{n}', String(o.ob))} players={teamB} />
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
          <i className="block bg-brand" style={{ width: `${o.pa}%` }} />
          <i className="block bg-upcoming" style={{ width: `${100 - o.pa}%` }} />
        </div>
        <div className="flex justify-between text-xs text-ink-2"><b className="text-ink">{o.pa} %</b><span>{ta.odds}</span><b className="text-ink">{100 - o.pa} %</b></div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!ready} onClick={playSolo}><Play className="size-5" aria-hidden />{ta.playSolo}</Button>
        <Button variant="secondary" disabled={!ready} loading={busy} onClick={playOnline}><Globe className="size-5" aria-hidden />{ta.playOnline}</Button>
      </div>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        <span className="display text-sm font-extrabold uppercase tracking-wider text-ink-2">{ta.onlineTitle}</span>
        {rooms.length === 0 && <p className="text-sm text-ink-2">{ta.noRooms}</p>}
        {rooms.map((r) => {
          const host = hostsQ.data?.find((g) => g.user.id === r.host_id)
          const rs = SPORTS.find((x) => x === r.sport) ?? 'basketball'
          return (
            <div key={r.code} className="flex items-center gap-3">
              {host ? <Avatar user={host.user} size={34} /> : <Globe className="size-6 text-live" aria-hidden />}
              <div className="min-w-0 flex-1">
                <b className="block truncate">{ta.hosts.replace('{name}', host ? firstName(host.user) : '…')}</b>
                <span className="flex items-center gap-1 text-xs text-ink-2"><SportIcon slug={rs} className="size-3.5" />{t.jeu.sports[rs]} · {t.jeu.format.replace(/\{n\}/g, String(r.size || 3))} · {r.filled ?? 0}/{(r.size || 3) * 2} · {tj.match.code} {r.code.toUpperCase()}</span>
              </div>
              <Button className="min-h-10 px-4 text-base" onClick={() => navigate(`/jeu/match/${r.code}`)}>{ta.join}</Button>
            </div>
          )
        })}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/courts/${data.court.id}`} className="display inline-flex items-center justify-center gap-2 rounded-xl border border-line py-3 font-bold uppercase"><MapPin className="size-4" aria-hidden />{ta.seeCourt}</Link>
        <Link to={`/games/new?court=${data.court.id}&sport=${sport}`} className="display inline-flex items-center justify-center gap-2 rounded-xl border border-line py-3 font-bold uppercase"><Plus className="size-4" aria-hidden />{ta.realGame}</Link>
      </div>
    </div>
  )
}

function TeamCol({ title, sub, players }: { title: string; sub: string; players: Pickable[] }) {
  return (
    <div className="grid min-w-0 justify-items-center gap-1.5 text-center">
      <div className="flex -space-x-2">{players.map((p) => <PlayerFace key={p.r.id} p={p} size={38} />)}</div>
      <b className="display w-full truncate text-base font-extrabold uppercase leading-none">{title}</b>
      <span className="text-xs text-ink-2">{sub}</span>
    </div>
  )
}
