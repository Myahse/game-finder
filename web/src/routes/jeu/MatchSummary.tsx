import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Medal, MessageCircle, Plus, RotateCcw, Swords, Users, X } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { Avatar, Button } from '../../components/ui'
import { ChallengeComposer } from '../../components/ChallengeComposer'
import type { PublicUser } from '../../lib/types'
import { WHATSAPP_COMMUNITY_URL, whatsappShareUrl } from '../../lib/whatsapp'
import { WhatsAppIcon } from '../../components/WhatsApp'
import { W, rating, type Moment, type Shot } from '../../jeu/engine'
import { courtFloors } from '../../jeu/stage'
import { FEED_ICON, useFill, type FeedContext } from '../../jeu/FeedText'
import { RatingPill } from './JeuMatchPage'

export interface SummaryData {
  P: { id: string; name: string; team: 0 | 1; st: { pts: number; reb: number; ast: number; stl: number; blk: number; fgm: number; fga: number; tpm: number; tpa: number; to: number } }[]
  score: [number, number]
  names: [string, string]
  moments: Moment[]
  me: number
  shots: Shot[]
  tir: number | null
  court: { id: string; name: string }
  online: boolean
  users: Record<string, PublicUser>
}

export function MatchSummary({ data, onAgain, onArena }: { data: SummaryData; onAgain?: () => void; onArena: () => void }) {
  const { t } = useLocale()
  const ts = t.jeu.summary
  const fill = useFill()
  const [challenge, setChallenge] = useState(false)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const w = data.score[0] >= data.score[1] ? 0 : 1
  const won = (team: number) => team === w
  const rated = data.P.map((p, i) => ({ p, i, r: rating(p, won(p.team)) })).sort((a, b) => b.r - a.r)
  const mvp = rated[0]
  const me = data.P[data.me] ?? data.P[0]
  const user = (id: string) => data.users[id.toLowerCase()]
  const ctx: FeedContext = { names: data.P.map((p) => p.name), teams: data.names, side: data.P.map((p) => p.team) }
  const rival = user(data.P[3].id)

  useEffect(() => {
    const c = chartRef.current
    if (!c) return
    const s = c.getContext('2d')!
    s.clearRect(0, 0, 300, 300); s.save(); s.scale(300 / W, 300 / W); s.drawImage(courtFloors().top, 0, 0, W, 380); s.restore()
    for (const q of data.shots) {
      const x = (q.x * 300) / W, y = (q.y * 300) / W
      if (q.made) { s.fillStyle = '#22c55e'; s.beginPath(); s.arc(x, y, 7, 0, Math.PI * 2); s.fill(); s.strokeStyle = '#05230f'; s.lineWidth = 2; s.stroke() }
      else { s.strokeStyle = '#ef4444'; s.lineWidth = 3.5; s.beginPath(); s.moveTo(x - 6, y - 6); s.lineTo(x + 6, y + 6); s.moveTo(x + 6, y - 6); s.lineTo(x - 6, y + 6); s.stroke() }
    }
  }, [data.shots])

  const shareText = ts.shareText
    .replace('{court}', data.court.name).replace('{a}', data.names[0]).replace('{sa}', String(data.score[0])).replace('{sb}', String(data.score[1]))
    .replace('{b}', data.names[1]).replace('{mvp}', mvp.p.name).replace('{pts}', String(mvp.p.st.pts)) + ' https://www.outforground.com'
  const shotLine = me.st.fga
    ? (data.tir !== null ? ts.shotText : ts.shotTextShort).replace('{m}', String(me.st.fgm)).replace('{a}', String(me.st.fga)).replace('{tm}', String(me.st.tpm)).replace('{ta}', String(me.st.tpa)).replace('{tir}', String(data.tir))
    : ts.noShots.replace('{name}', me.name)
  const keyMoments = [...data.moments.filter((x) => x.k !== 'three').slice(-5), ...data.moments.filter((x) => x.k === 'three').slice(-2)].sort((a, b) => a.t - b.t).slice(-7)

  const row = (p: SummaryData['P'][number], i: number) => {
    const u = user(p.id), r = rating(p, won(p.team))
    return (
      <tr key={i} className={i === data.me ? 'bg-brand/10' : ''}>
        <td className="flex items-center gap-1.5 py-1.5 pl-2">{u ? <Avatar user={u} size={22} /> : <i className="size-[22px] rounded-full bg-surface-2" />}<span className="truncate">{p.name}</span></td>
        <td>{p.st.pts}</td><td>{p.st.reb}</td><td>{p.st.ast}</td><td>{p.st.stl}</td><td>{p.st.blk}</td><td>{p.st.fgm}/{p.st.fga}</td>
        <td className="pr-2"><RatingPill r={r} /></td>
      </tr>
    )
  }

  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 pb-8 pt-1">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onArena} className="inline-flex items-center gap-1 text-sm text-ink-2"><ArrowLeft className="size-4" aria-hidden />{ts.back}</button>
        <span className="display rounded-full border border-line px-2.5 py-0.5 text-xs font-extrabold uppercase text-ink-2">{data.online ? ts.online : ts.simulated}</span>
      </div>
      <div className="grid justify-items-center gap-1 text-center">
        <span className={`display text-xl font-black uppercase ${w ? 'text-upcoming' : 'text-[var(--gold)]'}`}>{ts.wins.replace('{team}', data.names[w])}</span>
        <span className="display text-6xl font-black tabular-nums">{data.score[0]} – {data.score[1]}</span>
        <span className="text-xs text-ink-2">{ts.where.replace('{court}', data.court.name)}</span>
      </div>

      <section className="flex items-center gap-3 rounded-2xl border border-[var(--gold)] bg-surface p-3">
        <Medal className="size-7 shrink-0 text-[var(--gold)]" aria-hidden />
        {user(mvp.p.id) && <Avatar user={user(mvp.p.id)!} size={48} />}
        <div className="min-w-0 flex-1">
          <span className="display text-xs font-extrabold uppercase tracking-wider text-[var(--gold)]">{ts.mvp}</span>
          <b className="display block truncate text-2xl font-black uppercase leading-none">{mvp.p.name}</b>
          <span className="text-xs text-ink-2">{ts.mvpLine.replace('{pts}', String(mvp.p.st.pts)).replace('{reb}', String(mvp.p.st.reb)).replace('{ast}', String(mvp.p.st.ast))}</span>
        </div>
        <RatingPill r={mvp.r} />
      </section>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[22rem] text-center text-sm tabular-nums [&_td]:py-1 [&_th]:py-2">
          <thead className="display text-[11px] uppercase tracking-wider text-ink-2">
            <tr><th className="pl-2 text-left">{ts.head.player}</th><th>{ts.head.pts}</th><th>{ts.head.reb}</th><th>{ts.head.ast}</th><th>{ts.head.stl}</th><th>{ts.head.blk}</th><th>{ts.head.fg}</th><th className="pr-2">{ts.head.rating}</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={8} className="display bg-brand/10 pl-2 text-left text-xs font-extrabold uppercase text-brand">{data.names[0]} · {data.score[0]}</td></tr>
            {data.P.slice(0, 3).map((p, i) => row(p, i))}
            <tr><td colSpan={8} className="display bg-upcoming/10 pl-2 text-left text-xs font-extrabold uppercase text-upcoming">{data.names[1]} · {data.score[1]}</td></tr>
            {data.P.slice(3).map((p, i) => row(p, i + 3))}
          </tbody>
        </table>
      </div>

      <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,.8fr)] items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <div className="grid gap-1.5">
          <span className="display text-xs font-extrabold uppercase tracking-wider text-ink-2">{ts.shots.replace('{name}', me.name)}</span>
          <canvas ref={chartRef} width={300} height={300} className="aspect-square w-full rounded-lg" />
        </div>
        <div className="grid gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-live" />{ts.made}</span>
          <span className="inline-flex items-center gap-1.5"><X className="size-3 text-danger" aria-hidden />{ts.missed}</span>
          <span className="text-ink-2">{shotLine}</span>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        <span className="display text-xs font-extrabold uppercase tracking-wider text-ink-2">{ts.moments}</span>
        {keyMoments.length === 0 && <span className="text-sm text-ink-2">{ts.noMoments}</span>}
        <ul className="grid gap-1.5">
          {keyMoments.map((mo, i) => {
            const Icon = FEED_ICON[mo.k] ?? Medal
            const tpl = (t.jeu.moment as Record<string, string>)[mo.k] ?? ''
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="display w-12 shrink-0 font-bold tabular-nums text-ink-2">{mo.s[0]}–{mo.s[1]}</span>
                <Icon className="size-4 shrink-0 text-ink-2" aria-hidden />
                <span className="min-w-0">{fill(tpl, { p: mo.p, team: data.P[mo.p[0] ?? 0]?.team }, ctx)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-1 rounded-2xl border border-dashed border-line p-3">
        <b className="text-sm">{ts.zeroXp}</b>
        <span className="text-xs text-ink-2">{ts.zeroXpBody}</span>
      </div>

      <div className="grid gap-2">
        {rival ? (
          <Button onClick={() => setChallenge(true)}><Swords className="size-5" aria-hidden />{ts.challenge.replace('{team}', data.names[1])}</Button>
        ) : (
          <Link to="/challenges" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-white"><Swords className="size-5" aria-hidden />{ts.challenge.replace('{team}', data.names[1])}</Link>
        )}
        {data.court.id && (
          <Link to={`/games/new?court=${data.court.id}&sport=basketball`} className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line text-lg font-bold"><Plus className="size-5" aria-hidden />{ts.realGame}</Link>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-2 text-center text-base font-bold leading-tight text-white"><WhatsAppIcon className="size-5 shrink-0" />{ts.share}</a>
          <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#1fa855] px-2 text-center text-base font-bold leading-tight text-[#3ddc84]"><Users className="size-5 shrink-0" aria-hidden />{ts.community}</a>
        </div>
        {onAgain && <Button variant="secondary" onClick={onAgain}><RotateCcw className="size-5" aria-hidden />{ts.again}</Button>}
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-2"><MessageCircle className="size-3.5" aria-hidden />{t.jeu.avatar.onlyReal}</p>
      {challenge && rival && <ChallengeComposer opponent={rival} court={data.court.id ? data.court : undefined} onClose={() => setChallenge(false)} />}
    </div>
  )
}
