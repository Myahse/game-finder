import { Link } from 'react-router-dom'
import { Brush, Crown, Medal, TrendingUp } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useAuth } from '../../lib/auth'
import { dayAndClock } from '../../lib/format'
import { Avatar, Skeleton } from '../../components/ui'
import { useJeuMe } from '../../jeu/data'
import { ATTR_KEYS, type AttrKey, type Attrs } from '../../jeu/engine'

/** The avatar's six attributes, today and 30 days ago, and the real games behind them. */
export function JeuAvatarPage() {
  const { t } = useLocale()
  const ta = t.jeu.avatar
  const { user } = useAuth()
  const { data: me, isLoading } = useJeuMe()
  if (isLoading || !me) return <div className="grid gap-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>

  const p = me.progress, s = me.sources
  const span = Math.max(1, p.next_level_xp - p.level_xp)
  const pct = Math.round(((p.xp - p.level_xp) / span) * 100)
  const src: Record<AttrKey, string> = {
    tir: ta.src.tir.replace('{ppg}', String(s.ppg)).replace('{best}', String(s.best_points)),
    pen: ta.src.pen.replace('{ppg}', String(s.ppg)).replace('{rpg}', String(s.rpg)).replace('{wins}', String(s.wins)),
    col: ta.src.col.replace('{apg}', String(s.apg)).replace('{big}', String(s.big_games)),
    def: ta.src.def.replace('{sb}', String(Math.round((s.spg + s.bpg) * 10) / 10)).replace('{rpg}', String(s.rpg)),
    end: ta.src.end.replace('{g30}', String(s.games_30d)).replace('{c30}', String(s.check_ins_30d)),
    men: ta.src.men.replace('{streak}', String(s.streak_weeks)).replace('{mvps}', String(s.mvps)).replace('{chal}', String(s.challenges_won)),
  }

  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 pb-6 pt-1">
      <h1 className="display text-3xl font-black uppercase">{ta.title}</h1>
      <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        {user && <Avatar user={user} size={72} />}
        <div className="grid min-w-0 flex-1 gap-1">
          <b className="display truncate text-2xl font-black uppercase leading-none">{user?.first_name} {user?.last_name?.slice(0, 1)}.</b>
          <span className="text-xs text-ink-2">{ta.level.replace('{n}', String(p.level))} · OVR <b className="text-ink">{me.ovr}</b> · #{me.number}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><i className="block h-full bg-[var(--gold)]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
          <span className="text-[11px] tabular-nums text-ink-2">{ta.xp.replace('{xp}', String(p.xp)).replace('{next}', String(p.next_level_xp))} · {ta.toNext.replace('{n}', String(Math.max(0, p.next_level_xp - p.xp)))}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-3">
        <Radar now={me.attributes} before={me.before} labels={ta.attr} />
        <div className="flex justify-center gap-4 text-[11px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-brand" />{ta.today}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-4 border-t border-dashed border-ink-2" />{ta.ago}</span>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        {ATTR_KEYS.map((k) => {
          const d = me.attributes[k] - me.before[k]
          return (
            <div key={k} className="grid grid-cols-[6.5rem_2.5rem_1fr] items-baseline gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
              <b className="text-sm">{ta.attr[k]}</b>
              <em className="display text-2xl font-black not-italic tabular-nums text-brand">{me.attributes[k]}</em>
              <small className="text-xs text-ink-2">{src[k]}{d > 0 && <span className="ml-1 inline-flex items-center gap-0.5 font-bold text-live"><TrendingUp className="size-3" aria-hidden />+{d}</span>}</small>
            </div>
          )
        })}
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        <span className="display text-xs font-extrabold uppercase tracking-wider text-ink-2">{ta.history}</span>
        {me.history.length === 0 && <p className="text-sm text-ink-2">{ta.historyEmpty}</p>}
        <ul className="grid gap-2">
          {me.history.map((h) => {
            const st = h.stats ?? {}
            const line = ['points', 'rebounds', 'assists'].filter((k) => st[k] != null).map((k) => `${st[k]} ${k === 'points' ? t.jeu.match.pts : k === 'rebounds' ? t.jeu.match.reb : t.jeu.match.ast}`).join(' · ')
            return (
              <li key={h.id}>
                <Link to={`/games/${h.id}`} className="grid gap-0.5 rounded-xl bg-surface-2 p-2.5">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {h.won === true ? <Crown className="size-4 text-[var(--gold)]" aria-hidden /> : <Medal className="size-4 text-ink-2" aria-hidden />}
                    {h.won === true ? ta.win : h.won === false ? ta.loss : ta.played} · {h.court}
                    {h.mvp && <span className="display rounded bg-[var(--gold)] px-1.5 text-xs font-black text-[#0d1117]">{ta.mvp}</span>}
                  </span>
                  <span className="text-xs text-ink-2">{dayAndClock(h.at)} · {ta.players.replace('{n}', String(h.players))}{line ? ` · ${line}` : ''}</span>
                  <span className="text-xs font-bold text-live">+{h.xp} XP</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <Link to="/profile/avatar" className="display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line text-lg font-bold"><Brush className="size-5" aria-hidden />{ta.studio}</Link>
      <p className="text-center text-xs text-ink-2">{ta.onlyReal}</p>
    </div>
  )
}

function Radar({ now, before, labels }: { now: Attrs; before: Attrs; labels: Record<AttrKey, string> }) {
  const cx = 150, cy = 128, R = 92, n = ATTR_KEYS.length
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] }
  const poly = (vals: Attrs) => ATTR_KEYS.map((k, i) => pt(i, vals[k]).join(',')).join(' ')
  return (
    <svg viewBox="0 0 300 250" className="w-full" role="img" aria-label={ATTR_KEYS.map((k) => `${labels[k]} ${now[k]}`).join(', ')}>
      {[25, 50, 75, 100].map((lv) => <polygon key={lv} points={ATTR_KEYS.map((_, i) => pt(i, lv).join(',')).join(' ')} fill="none" stroke="var(--line)" />)}
      {ATTR_KEYS.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" /> })}
      <polygon points={poly(before)} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="4 4" />
      <polygon points={poly(now)} fill="rgba(255,90,31,.28)" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
      {ATTR_KEYS.map((k, i) => {
        const [x, y] = pt(i, 122), [px, py] = pt(i, now[k])
        return (
          <g key={k}>
            <circle cx={px} cy={py} r="4" fill="var(--brand)" />
            <text x={x} y={y + 4} textAnchor="middle" fill="var(--ink)" fontFamily="Barlow Condensed" fontWeight="800" fontSize="13">{labels[k].toUpperCase()} {now[k]}</text>
          </g>
        )
      })}
    </svg>
  )
}
