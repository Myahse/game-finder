import type { AvatarConfigV2 } from './avatarPresets'
import type { PlayerAvatarConfig } from '../avatar/schema'

export type Activity = 'inactive' | 'players' | 'active'
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all_levels'
export type GameType = 'pickup' | 'training' | 'match' | 'tournament'
export type GameStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'
export type ReportType =
  | 'not_exist'
  | 'wrong_location'
  | 'closed'
  | 'wrong_info'
  | 'unsafe'
  | 'duplicate'
  | 'other'

export interface Sport {
  id: string
  name: string
  slug: string
  icon: string
  active: boolean
}

export interface PublicUser {
  id: string
  first_name: string
  last_name: string
  username: string
  avatar_url: string | null
  avatar_config?: AvatarConfigV2 | null
  player_avatar?: PlayerAvatarConfig | null
  player_avatar_public?: PlayerAvatarConfig | null
  preferred_sport_id: string | null
  skill_level: SkillLevel | null
  created_at: string
  stats?: { games_played: number; games_created: number }
}

export interface Me extends PublicUser {
  email: string
  role: 'user' | 'admin'
  onboarded: boolean
  /** Up to 2 sports in addition to preferred_sport_id. */
  extra_sport_ids?: string[]
}

export interface Court {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string | null
  description: string | null
  photos: string[]
  opening_hours: string | null
  lighting: boolean | null
  surface: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  sports: Sport[]
  player_count: number
  active_game_count: number
  activity: Activity
  last_activity_at: string | null
  distance_m: number | null
  created_at: string
  created_by: string | null
}

export interface CourtDetail extends Court {
  games: Game[]
  my_presence: { started_at: string; expires_at: string } | null
}

export interface Game {
  id: string
  court_id: string
  sport_id: string
  creator_id: string | null
  start_time: string
  duration_minutes: number
  max_players: number
  skill_level: SkillLevel
  game_type: GameType
  status: GameStatus
  cancelled_reason: string | null
  player_count: number
  spots_left: number | null
  joined: boolean
  court: Pick<Court, 'id' | 'name' | 'latitude' | 'longitude' | 'address'> & { photos?: string[] }
  sport: Sport
  creator: PublicUser | null
  distance_m: number | null
  players?: (PublicUser & { joined_at: string })[]
}

export interface Presence {
  id: string
  court_id: string
  started_at: string
  last_seen: string
  expires_at: string
  status: 'active' | 'expired' | 'left'
  warning_minutes: number
  court: Pick<Court, 'id' | 'name' | 'latitude' | 'longitude'>
}

export interface AppNotification {
  id: string
  type:
    | 'game_reminder'
    | 'game_invite'
    | 'game_activity'
    | 'presence_check'
    | 'game_cancelled'
    | 'game_created'
    | 'court_added'
    | 'court_pending_review'
    | 'admin_new_user'
    | 'admin_court_request'
    | 'friend_request'
    | 'friend_accepted'
    | 'achievement'
    | 'system'
  title: string
  body: string
  data: {
    game_id?: string
    court_id?: string
    presence_id?: string
    user_id?: string
    friend_request_id?: string
    kind?: 'badge' | 'streak' | 'king'
    badge_id?: string
  }
  read: boolean
  created_at: string
}

export interface Session {
  /** Mobile clients; web uses httpOnly cookies. */
  access_token?: string
  access_expires_at?: string
  refresh_token?: string
  refresh_expires_at?: string
  user: Me
}

// Realtime events pushed by the API over /api/ws
export type RealtimeEvent =
  | { type: 'hello' }
  | {
      type: 'court_stats'
      court_id: string
      player_count: number
      active_game_count: number
      activity: Activity
      last_activity_at: string | null
    }
  | {
      type: 'game'
      kind: 'insert' | 'update' | 'delete' | 'deleted' | 'players'
      game_id: string
      court_id: string
      status?: GameStatus
      player_count?: number
      max_players?: number
    }
  | {
      type: 'notification'
      id: string
      notification_type: AppNotification['type']
      title: string
      body: string
      data: AppNotification['data']
    }
