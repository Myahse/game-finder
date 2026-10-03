import type { LucideIcon } from 'lucide-react'
import {
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
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3l2.5 4.5L12 12l-2.5-4.5L12 3zM12 21l-2.5-4.5L12 12l2.5 4.5L12 21z" />
      <path d="M3 12l4.5-2.5L12 12l-4.5 2.5L3 12zM21 12l-4.5 2.5L12 12l4.5-2.5L21 12z" />
    </svg>
  )
}

export function TennisIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M4.5 4.5c6 6 9 9 15 15" />
    </svg>
  )
}

export function BadmintonIcon({ className }: IconProps) {
  return (
    <svg className={cn('shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 18l3-9 9-3-3 9-9 3z" />
      <circle cx="7" cy="19" r="1.5" fill="currentColor" stroke="none" />
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
  admin_new_user: UserPlus,
  admin_court_request: MapPinPlus,
  friend_request: UserPlus,
  friend_accepted: Handshake,
  presence_check: MapPin,
  game_cancelled: X,
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
