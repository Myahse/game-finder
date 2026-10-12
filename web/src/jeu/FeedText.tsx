import type { ReactNode } from 'react'
import {
  ArrowLeftRight, CircleDot, CircleSlash, ClipboardList, Flag, Flame, Hand, HandGrab, Pause, Repeat, Target, Timer, TrendingUp, Trophy, Zap,
  type LucideIcon,
} from 'lucide-react'
import { useLocale } from '../i18n/LocaleProvider'
import type { FeedLine } from './engine'

/** The icon in front of a feed line or a key moment. */
export const FEED_ICON: Record<string, LucideIcon> = {
  kickoff: Flag, dunk: Zap, dunkAst: Zap, three: Target, threeAst: Target, layup: CircleDot, layupAst: CircleDot, jumper: CircleDot, jumperAst: CircleDot,
  miss: CircleSlash, miss3: CircleSlash, missLayup: CircleSlash, block: Hand, steal: HandGrab, orb: Repeat, drb: Repeat, kickOut: ArrowLeftRight,
  fire: Flame, run: TrendingUp, win: Trophy, timeout: Pause, coach: ClipboardList, aiPlays: Timer,
}

export interface FeedContext {
  names: string[]
  teams: [string, string]
  /** Team of each player (0 or 1), for the name colours. */
  side: (0 | 1)[]
}

/** Fills {a} {b} {team} {score} {n} {v} with styled names and numbers. */
export function useFill() {
  const { t } = useLocale()
  return (template: string, line: Partial<FeedLine>, ctx: FeedContext): ReactNode[] => {
    const parts = template.split(/(\{a\}|\{b\}|\{team\}|\{score\}|\{n\}|\{v\})/)
    return parts.map((part, i) => {
      const who = part === '{a}' ? line.p?.[0] : part === '{b}' ? line.p?.[1] : undefined
      if (who !== undefined) return <b key={i} className={ctx.side[who] ? 'text-upcoming' : 'text-brand'}>{ctx.names[who] ?? '?'}</b>
      if (part === '{team}') { const tm = line.team ?? 0; return <b key={i} className={tm ? 'text-upcoming' : 'text-brand'}>{ctx.teams[tm]}</b> }
      if (part === '{score}') return <b key={i} className="text-ink">{line.s ? `${line.s[0]} – ${line.s[1]}` : ''}</b>
      if (part === '{n}') return <b key={i}>{line.n ?? 0}</b>
      if (part === '{v}') return <span key={i}>{(t.jeu.match.coach as Record<string, string>)[line.v ?? ''] ?? ''}</span>
      return part
    })
  }
}

export function FeedText({ line, ctx }: { line: FeedLine; ctx: FeedContext }) {
  const { t } = useLocale()
  const fill = useFill()
  const tpl = (t.jeu.feed as Record<string, string>)[line.k]
  if (!tpl) return null
  const Icon = FEED_ICON[line.k] ?? CircleDot
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon className="size-3.5 shrink-0 text-ink-2" aria-hidden />
      <span className="truncate">{fill(tpl, line, ctx)}</span>
    </span>
  )
}
