import type { LucideIcon } from 'lucide-react'
import {
  Trophy,
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Flame,
  Handshake,
  Hourglass,
  Lightbulb,
  LocateFixed,
  MapPin,
  MapPinPlus,
  Maximize2,
  Megaphone,
  Minimize2,
  Minus,
  Plus,
  SearchX,
  User,
  UserPlus,
  Users,
  Volleyball,
  Wrench,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Activity, AppNotification } from '../lib/types'
import { useSportTheme } from '../theme/SportThemeProvider'

export type IconProps = { className?: string }

const cn = (base: string, className?: string) => (className ? `${base} ${className}` : base)

export function BasketballIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13" />
    </svg>
  )
}

export function FootballIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 8.2z" fill="currentColor" fillOpacity="0.25" />
      <path d="M12 8.2V3.4M15.6 10.8l4.6-1.5M14.2 15l2.8 3.9M9.8 15L7 18.9M8.4 10.8L3.8 9.3" />
    </svg>
  )
}

export function TennisIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 4.6c2.6 2 3.9 4.5 3.9 7.4S8.6 17.4 6 19.4" />
      <path d="M18 4.6c-2.6 2-3.9 4.5-3.9 7.4s1.3 5.4 3.9 7.4" />
    </svg>
  )
}

export function BadmintonIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.2 14.8L13 3.6c3.6.6 6.8 3.8 7.4 7.4L9.2 14.8z" />
      <path d="M9.2 14.8l7.4-9.3" />
      <circle cx="6.6" cy="17.4" r="3" fill="currentColor" fillOpacity="0.25" />
    </svg>
  )
}

const sportBySlug: Record<string, (p: IconProps) => ReactNode> = {
  basketball: BasketballIcon,
  football: FootballIcon,
  volleyball: (p) => <Volleyball {...p} aria-hidden />,
  tennis: TennisIcon,
  badminton: BadmintonIcon,
}

export function SportIcon({ slug, className = 'size-5' }: { slug: string; className?: string }) {
  const Icon = sportBySlug[slug] ?? MapPin
  return <Icon className={className} />
}

/** Icon of the user's base sport — the app's sport mark (nav, empty states, prompts). */
export function BaseSportIcon({ className = 'size-5' }: { className?: string }) {
  const slug = useSportTheme()
  return <SportIcon slug={slug ?? 'basketball'} className={className} />
}

export function SportName({
  sport,
  className,
  iconClassName = 'size-4',
}: {
  sport: { slug: string; name: string }
  className?: string
  iconClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <SportIcon slug={sport.slug} className={iconClassName} />
      {sport.name}
    </span>
  )
}

export function DistanceText({
  children,
  className,
  iconClassName = 'size-4',
}: {
  children: ReactNode
  className?: string
  iconClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <MapPin className={cn('shrink-0', iconClassName)} aria-hidden />
      {children}
    </span>
  )
}

export function TimeText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Clock className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

export function LiveText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <Flame className="size-4 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

export const activityIcons: Record<Activity, LucideIcon> = {
  active: Flame,
  players: Users,
  inactive: Circle,
}

export const notificationIcons: Record<AppNotification['type'], LucideIcon> = {
  game_reminder: Clock,
  game_invite: Handshake,
  game_activity: Flame,
  game_created: Volleyball,
  court_added: MapPinPlus,
  court_pending_review: Hourglass,
  admin_new_user: UserPlus,
  admin_court_request: MapPinPlus,
  friend_request: UserPlus,
  friend_accepted: Handshake,
  presence_check: MapPin,
  game_cancelled: X,
  achievement: Trophy,
  system: Megaphone,
}

export {
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  Circle,
  Clock,
  Flame,
  Hourglass,
  Lightbulb,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  SearchX,
  User,
  Users,
  Wrench,
  X,
}
