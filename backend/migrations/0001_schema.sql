-- Find the Game — core schema
-- Tables, enums, settings and helper functions. Business logic (triggers,
-- game/presence functions, lifecycle tick, admin) lives in 0002_logic.sql.
--
-- The Go API is the only database client. It opens a transaction per request
-- and sets `app.user_id`; SQL functions read it through app_uid().

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.skill_level as enum ('beginner', 'intermediate', 'advanced', 'all_levels');
create type public.game_type as enum ('pickup', 'training', 'match', 'tournament');
create type public.game_status as enum ('scheduled', 'active', 'completed', 'cancelled');
create type public.game_player_status as enum ('joined', 'left', 'removed');
create type public.presence_status as enum ('active', 'expired', 'left');
create type public.court_status as enum ('pending', 'approved', 'rejected');
create type public.court_activity as enum ('inactive', 'players', 'active');
create type public.report_type as enum (
  'not_exist', 'wrong_location', 'closed', 'wrong_info', 'unsafe', 'duplicate', 'other'
);
create type public.report_status as enum ('open', 'resolved', 'rejected');
create type public.notification_type as enum (
  'game_reminder', 'game_invite', 'game_activity', 'presence_check', 'game_cancelled', 'system'
);

-- ---------------------------------------------------------------------------
-- Settings: tunables that must be changeable without a deploy
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('presence_minutes',            '30',  'How long an I''M HERE check-in lasts before it expires'),
  ('presence_warning_minutes',    '5',   'Minutes before expiry to ask "Are you still playing?"'),
  ('presence_max_distance_m',     '500', 'Max distance from the court to check in (0 disables the check)'),
  ('active_court_min_players',    '6',   'Players needed for GAME ACTIVE when no game was created'),
  ('game_reminder_minutes',       '30',  'Minutes before start to send the game reminder'),
  ('activity_alert_radius_km',    '3',   'Radius for "a game is active near you" alerts'),
  ('activity_alert_cooldown_min', '120', 'Min minutes between activity alerts for one court/user');

create or replace function public.setting_int(p_key text, p_default int)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default);
$$;

-- Current request's user, set by the API with set_config('app.user_id', ..., true).
create or replace function public.app_uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Sports
-- ---------------------------------------------------------------------------
create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text not null,                 -- emoji used in markers and filters
  active boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users (account + profile). password_hash, email and notify_* are never
-- returned to other users by the API.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  password_hash text not null,
  first_name text not null check (char_length(first_name) between 1 and 50),
  last_name text not null check (char_length(last_name) between 1 and 50),
  username citext not null unique
    check (username ~ '^[A-Za-z0-9_.]{3,24}$'),
  avatar_url text,
  preferred_sport_id uuid references public.sports (id) on delete set null,
  skill_level public.skill_level,
  role public.user_role not null default 'user',
  suspended_at timestamptz,
  onboarded_at timestamptz,
  -- Coarse (~1 km) area used only for "game active near you" alerts.
  notify_lat numeric(6, 2),
  notify_lng numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Refresh tokens (hashed). Access tokens are short-lived JWTs.
create table public.refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index refresh_tokens_user_idx on public.refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Courts
-- ---------------------------------------------------------------------------
create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  address text,
  description text,
  photos text[] not null default '{}',
  opening_hours text,
  lighting boolean,
  surface text,
  status public.court_status not null default 'pending',
  rejection_reason text,
  created_by uuid references public.users (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courts_status_idx on public.courts (status);
create index courts_lat_lng_idx on public.courts (latitude, longitude);

create table public.court_sports (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete cascade,
  unique (court_id, sport_id)
);
create index court_sports_sport_idx on public.court_sports (sport_id);

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts (id) on delete cascade,
  sport_id uuid not null references public.sports (id),
  creator_id uuid references public.users (id) on delete set null,
  start_time timestamptz not null,
  duration_minutes int not null default 120 check (duration_minutes between 15 and 600),
  max_players int not null default 10 check (max_players between 2 and 50),
  skill_level public.skill_level not null default 'all_levels',
  game_type public.game_type not null default 'pickup',
  status public.game_status not null default 'scheduled',
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_court_status_idx on public.games (court_id, status);
create index games_status_start_idx on public.games (status, start_time);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  status public.game_player_status not null default 'joined',
  reminded_at timestamptz,
  unique (game_id, user_id)
);
create index game_players_user_idx on public.game_players (user_id, status);

-- ---------------------------------------------------------------------------
-- Presence ("I'M HERE"). Exact coordinates are private to the owner.
-- ---------------------------------------------------------------------------
create table public.court_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  court_id uuid not null references public.courts (id) on delete cascade,
  latitude double precision,
  longitude double precision,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  expires_at timestamptz not null,
  warned_at timestamptz,
  ended_at timestamptz,
  status public.presence_status not null default 'active'
);
-- One live check-in per user.
create unique index court_presence_one_active_idx
  on public.court_presence (user_id) where status = 'active';
create index court_presence_court_active_idx
  on public.court_presence (court_id) where status = 'active';
create index court_presence_expiry_idx
  on public.court_presence (expires_at) where status = 'active';

-- ---------------------------------------------------------------------------
-- Aggregated, public, realtime-friendly court activity.
-- This is the ONLY presence data other users can see.
-- ---------------------------------------------------------------------------
create table public.court_live_stats (
  court_id uuid primary key references public.courts (id) on delete cascade,
  player_count int not null default 0,
  present_count int not null default 0,
  active_game_count int not null default 0,
  activity public.court_activity not null default 'inactive',
  last_activity_at timestamptz,
  became_active_at timestamptz,
  announced_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  court_id uuid not null references public.courts (id) on delete cascade,
  type public.report_type not null,
  description text check (char_length(description) <= 1000),
  status public.report_status not null default 'open',
  admin_note text,
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications + push tokens
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read boolean not null default false,
  push boolean not null default true,      -- false = in-app only
  pushed_at timestamptz,
  dedupe_key text unique,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at)
  where push and pushed_at is null;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger courts_updated_at before update on public.courts
  for each row execute function public.set_updated_at();
create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();
create trigger push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- Great-circle distance in metres.
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = app_uid() and role = 'admin' and suspended_at is null
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = app_uid() and suspended_at is null
  );
$$;
