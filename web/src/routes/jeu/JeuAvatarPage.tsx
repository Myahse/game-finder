import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Brush, Crown, Lock, Medal, TrendingUp } from 'lucide-react'
import { useLocale } from '../../i18n/LocaleProvider'
import { useAuth } from '../../lib/auth'
import { dayAndClock } from '../../lib/format'
import { Avatar, Skeleton } from '../../components/ui'
import { SportIcon } from '../../components/icons'
import { useJeuMe } from '../../jeu/data'
import { ATTR_KEYS, SPORTS, type AttrKey, type Attrs, type Sport } from '../../jeu/engine'
import { sportWords } from '../../jeu/words'

const BADGES = ['first_win', 'wins_10', 'wins_50', 'mvp_5', 'online_win', 'all_sports', 'sniper', 'hat_trick', 'ace_volley', 'ace_tennis', 'smash_5', 'week_max']

/** The avatar's six attributes, today and 30 days ago, and the real games behind them. */
export function JeuAvatarPage() {
  const { t } = useLocale()
  const ta = t.jeu.avatar
  const { user } = useAuth()
  const [sport, setSport] = useState<Sport>('basketball')
  const { data: me, isLoading } = useJeuMe(true, sport)
  const tx = t.jeu.xp
  if (isLoading || !me) return <div className="grid gap-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>

  const g = me.game, s = me.sources, words = sportWords(t, sport)
  // The avatar's level counts real XP and Mode Jeu XP.
  const lvXp = (n: number) => 50 * n * (n - 1)
  const span = Math.max(1, lvXp(g.avatar_level + 1) - lvXp(g.avatar_level))
  const pct = Math.round(((g.avatar_xp - lvXp(g.avatar_level)) / span) * 100)
  const k = (i: number) => (t.scoreboard.statNames[s.keys?.[i] ?? ''] ?? s.keys?.[i] ?? '').toLowerCase()
  const src: Record<AttrKey, string> = {
    tir: t.jeu.srcAny.tir.replace('{v1}', String(s.s1)).replace('{k1}', k(0)).replace('{best}', String(s.best)),
    pen: t.jeu.srcAny.pen.replace('{v2}', String(s.s2)).replace('{k2}', k(1)).replace('{wins}', String(s.wins)).replace('{games}', String(s.games)),
    col: t.jeu.srcAny.col.replace('{v3}', String(s.s3)).replace('{k3}', k(2)).replace('{big}', String(s.big_games)),
    def: t.jeu.srcAny.def.replace('{v4}', String(s.s4)).replace('{k4}', k(3)).replace('{elo}', String(s.elo)),
    end: ta.src.end.replace('{g30}', String(s.games_30d)).replace('{c30}', String(s.check_ins_30d)),
    men: ta.src.men.replace('{streak}', String(s.streak_weeks)).replace('{mvps}', String(s.mvps)).replace('{chal}', String(s.challenges_won)),
  }
  const have = new Set(g.badges.map((b) => b.id))
  const weekPct = Math.round((g.week / Math.max(1, g.cap)) * 100)

  return (
    <div className="mx-auto grid max-w-xl gap-3 px-4 pb-6 pt-1">
      <h1 className="display text-3xl font-black uppercase">{ta.title}</h1>
      <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        {user && <Avatar user={user} size={72} />}
        <div className="grid min-w-0 flex-1 gap-1">
          <b className="display truncate text-2xl font-black uppercase leading-none">{user?.first_name} {user?.last_name?.slice(0, 1)}.</b>
          <span className="text-xs text-ink-2">{ta.level.replace('{n}', String(g.avatar_level))} · OVR <b className="text-ink">{me.ovr}</b> · #{me.number}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2"><i className="block h-full bg-[var(--gold)]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
          <span className="text-[11px] tabular-nums text-ink-2">{ta.xp.replace('{xp}', String(g.avatar_xp)).replace('{next}', String(lvXp(g.avatar_level + 1)))} · {ta.toNext.replace('{n}', String(Math.max(0, lvXp(g.avatar_level + 1) - g.avatar_xp)))}</span>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="display text-xs font-extrabold uppercase tracking-wider text-ink-2">{tx.title}</span>
          <b className="display text-sm tabular-nums">{tx.week.replace('{week}', String(g.week)).replace('{cap}', String(g.cap))}</b>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2"><i className="block h-full bg-live" style={{ width: `${Math.min(100, weekPct)}%` }} /></div>
        <span className="text-xs text-ink-2">{tx.total.replace('{n}', String(g.total)).replace('{w}', String(g.wins)).replace('{m}', String(g.matches))} · {tx.resets.replace('{date}', new Date(g.week_ends_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
        <span className="display mt-1 text-xs font-extrabold uppercase tracking-wider text-ink-2">{tx.badges} · {have.size}/{BADGES.length}</span>
        {have.size === 0 && <span className="text-xs text-ink-2">{tx.noBadges}</span>}
        <ul className="grid grid-cols-4 gap-2">
          {BADGES.map((b) => {
            const on = have.has(b)
            return (
              <li key={b} title={t.jeu.badgeHow[b]} className={`grid justify-items-center gap-1 rounded-xl border p-2 text-center ${on ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-line bg-surface-2 opacity-60'}`}>
                {on ? <Award className="size-6 text-[var(--gold)]" aria-hidden /> : <Lock className="size-5 text-ink-2" aria-hidden />}
                <b className="text-[10px] leading-tight">{t.jeu.badge[b]}</b>
                <small className="text-[9px] leading-tight text-ink-2">{t.jeu.badgeHow[b]}</small>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist">
        {SPORTS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={x === sport} onClick={() => setSport(x)}
            className={`display inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-extrabold uppercase ${x === sport ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink-2'}`}>
            <SportIcon slug={x} className="size-4" />{t.jeu.sports[x]}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-3">
        <Radar now={me.attributes} before={me.before} labels={words.attr} />
        <div className="flex justify-center gap-4 text-[11px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-4 bg-brand" />{ta.today}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-4 border-t border-dashed border-ink-2" />{ta.ago}</span>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3">
        {ATTR_KEYS.map((a) => {
          const k = a
          const d = me.attributes[k] - me.before[k]
          return (
            <div key={k} className="grid grid-cols-[6.5rem_2.5rem_1fr] items-baseline gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
              <b className="text-sm">{words.attr[k]}</b>
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
            const line = (h.stat_keys ?? []).slice(0, 3).filter((x) => st[x] != null).map((x) => `${st[x]} ${(t.scoreboard.statNames[x] ?? x).toLowerCase()}`).join(' · ')
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
