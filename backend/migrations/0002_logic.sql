-- Find the Game — business logic
-- Live court stats, game/presence functions, lifecycle tick,
-- notification generators and admin RPCs.

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_username ~ '^[A-Za-z0-9_.]{3,24}$'
     and not exists (select 1 from public.users where username = p_username::citext);
$$;

-- ---------------------------------------------------------------------------
-- Live court stats
-- player_count = distinct users checked in OR playing in an active game.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_court_stats(p_court_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_players int;
  v_present int;
  v_games int;
  v_last timestamptz;
  v_activity public.court_activity;
  v_threshold int := public.setting_int('active_court_min_players', 6);
begin
  if p_court_id is null then
    return;
  end if;

  select count(*) into v_present
  from public.court_presence
  where court_id = p_court_id and status = 'active' and expires_at > now();

  -- An "active" game nobody is in (everyone left) doesn't make a court live.
  select count(*) into v_games
  from public.games g
  where g.court_id = p_court_id and g.status = 'active'
    and exists (select 1 from public.game_players gp where gp.game_id = g.id and gp.status = 'joined');

  select count(distinct user_id), max(ts) into v_players, v_last
  from (
    select user_id, last_seen as ts
    from public.court_presence
    where court_id = p_court_id and status = 'active' and expires_at > now()
    union all
    select gp.user_id, greatest(gp.joined_at, g.start_time) as ts
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where g.court_id = p_court_id and g.status = 'active' and gp.status = 'joined'
  ) s;

  v_activity := case
    when v_games > 0 or v_players >= v_threshold then 'active'
    when v_players > 0 then 'players'
    else 'inactive'
  end::public.court_activity;

  insert into public.court_live_stats as s (
    court_id, player_count, present_count, active_game_count, activity,
    last_activity_at, became_active_at, updated_at
  )
  values (
    p_court_id, v_players, v_present, v_games, v_activity,
    v_last, case when v_activity = 'active' then now() end, now()
  )
  on conflict (court_id) do update set
    player_count = excluded.player_count,
    present_count = excluded.present_count,
    active_game_count = excluded.active_game_count,
    activity = excluded.activity,
    last_activity_at = coalesce(excluded.last_activity_at, s.last_activity_at),
    became_active_at = case
      when excluded.activity = 'active' and s.activity <> 'active' then now()
      else s.became_active_at
    end,
    updated_at = now()
  -- Avoid realtime noise when nothing changed.
  where (s.player_count, s.present_count, s.active_game_count, s.activity)
     is distinct from
        (excluded.player_count, excluded.present_count, excluded.active_game_count, excluded.activity)
     or excluded.last_activity_at is distinct from s.last_activity_at;
end;
$$;

create or replace function public.trg_refresh_stats_from_presence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_court_stats(old.court_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.court_id <> old.court_id) then
    perform public.refresh_court_stats(new.court_id);
  end if;
  return null;
end;
$$;

create trigger court_presence_stats
  after insert or update or delete on public.court_presence
  for each row execute function public.trg_refresh_stats_from_presence();

create or replace function public.trg_refresh_stats_from_game()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_court_stats(old.court_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.court_id <> old.court_id) then
    perform public.refresh_court_stats(new.court_id);
  end if;
  return null;
end;
$$;

create trigger games_stats
  after insert or update of status, court_id or delete on public.games
  for each row execute function public.trg_refresh_stats_from_game();

create or replace function public.trg_refresh_stats_from_player()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_court_stats(
    (select court_id from public.games where id = coalesce(new.game_id, old.game_id))
  );
  return null;
end;
$$;

create trigger game_players_stats
  after insert or update or delete on public.game_players
  for each row execute function public.trg_refresh_stats_from_player();

create or replace function public.trg_court_created()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.court_live_stats (court_id) values (new.id)
  on conflict do nothing;
  return null;
end;
$$;

create trigger courts_init_stats
  after insert on public.courts
  for each row execute function public.trg_court_created();

-- ---------------------------------------------------------------------------
-- Courts: users can only propose (always PENDING). System inserts (seeds,
-- migrations: no app.user_id) and admins are trusted.
-- ---------------------------------------------------------------------------
create or replace function public.trg_court_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if app_uid() is not null and not public.is_admin() then
    new.status := 'pending';
    new.created_by := app_uid();
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.rejection_reason := null;
  end if;
  return new;
end;
$$;

create trigger courts_guard
  before insert on public.courts
  for each row execute function public.trg_court_guard();

-- ---------------------------------------------------------------------------
-- Games: validation, initial status, creator auto-join
-- ---------------------------------------------------------------------------
create or replace function public.trg_game_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_joined int;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.courts where id = new.court_id and status = 'approved') then
      raise exception 'court_not_available' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.court_sports where court_id = new.court_id and sport_id = new.sport_id
    ) then
      raise exception 'sport_not_offered_at_court' using errcode = 'P0001';
    end if;
    if new.start_time < now() - interval '15 minutes' then
      raise exception 'start_time_in_past' using errcode = 'P0001';
    end if;
    if new.start_time > now() + interval '30 days' then
      raise exception 'start_time_too_far' using errcode = 'P0001';
    end if;
    new.status := case when new.start_time <= now() then 'active' else 'scheduled' end;
    new.cancelled_reason := null;
  else
    -- Only admins may move a game to another court or re-assign it.
    if app_uid() is not null and not public.is_admin()
       and (new.court_id <> old.court_id or new.creator_id is distinct from old.creator_id) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    if new.max_players <> old.max_players then
      select count(*) into v_joined from public.game_players
      where game_id = new.id and status = 'joined';
      if new.max_players < v_joined then
        raise exception 'max_players_below_current' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger games_before_write
  before insert or update on public.games
  for each row execute function public.trg_game_before_write();

create or replace function public.trg_game_after_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.creator_id is not null then
    insert into public.game_players (game_id, user_id) values (new.id, new.creator_id)
    on conflict (game_id, user_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger games_creator_joins
  after insert on public.games
  for each row execute function public.trg_game_after_insert();

-- ---------------------------------------------------------------------------
-- Join / leave / cancel
-- ---------------------------------------------------------------------------
create or replace function public.join_game(p_game_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_game public.games;
  v_count int;
  v_existing public.game_player_status;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Row lock serialises concurrent joins so max_players can't be exceeded.
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.status in ('cancelled', 'completed') then
    raise exception 'game_closed' using errcode = 'P0001';
  end if;

  select status into v_existing from public.game_players
  where game_id = p_game_id and user_id = v_uid;
  if v_existing = 'joined' then
    raise exception 'already_joined' using errcode = 'P0001';
  end if;
  if v_existing = 'removed' then
    raise exception 'removed_from_game' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.game_players
  where game_id = p_game_id and status = 'joined';
  if v_count >= v_game.max_players then
    raise exception 'game_full' using errcode = 'P0001';
  end if;

  insert into public.game_players (game_id, user_id, status, joined_at, left_at)
  values (p_game_id, v_uid, 'joined', now(), null)
  on conflict (game_id, user_id) do update
    set status = 'joined', joined_at = now(), left_at = null, reminded_at = null;

  return v_count + 1;
end;
$$;

create or replace function public.leave_game(p_game_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform 1 from public.games where id = p_game_id for update;

  update public.game_players
  set status = 'left', left_at = now()
  where game_id = p_game_id and user_id = v_uid and status = 'joined';
  if not found then
    raise exception 'not_in_game' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.game_players
  where game_id = p_game_id and status = 'joined';
  return v_count;
end;
$$;

create or replace function public.cancel_game(p_game_id uuid, p_reason text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_game public.games;
  v_court text;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.creator_id is distinct from app_uid() and not public.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_game.status in ('cancelled', 'completed') then
    raise exception 'game_closed' using errcode = 'P0001';
  end if;

  update public.games
  set status = 'cancelled', cancelled_reason = nullif(trim(p_reason), '')
  where id = p_game_id;

  select name into v_court from public.courts where id = v_game.court_id;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select gp.user_id, 'game_cancelled', 'Game cancelled',
         'The game at ' || v_court || ' was cancelled.',
         jsonb_build_object('game_id', p_game_id, 'court_id', v_game.court_id),
         'cancelled:' || p_game_id || ':' || gp.user_id
  from public.game_players gp
  where gp.game_id = p_game_id and gp.status = 'joined'
    and gp.user_id is distinct from app_uid()
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.invite_to_game(p_game_id uuid, p_username text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_invitee uuid;
  v_inviter text;
  v_sport text;
  v_court uuid;
begin
  if not exists (
    select 1 from public.game_players
    where game_id = p_game_id and user_id = v_uid and status = 'joined'
  ) then
    raise exception 'not_in_game' using errcode = 'P0001';
  end if;

  select id into v_invitee from public.users
  where username = p_username::citext and suspended_at is null;
  if v_invitee is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  select p.first_name into v_inviter from public.users p where p.id = v_uid;
  select lower(s.name), g.court_id into v_sport, v_court
  from public.games g join public.sports s on s.id = g.sport_id where g.id = p_game_id;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  values (
    v_invitee, 'game_invite', 'Game invitation',
    v_inviter || ' invited you to a ' || v_sport || ' game.',
    jsonb_build_object('game_id', p_game_id, 'court_id', v_court),
    'invite:' || p_game_id || ':' || v_invitee
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Presence
-- ---------------------------------------------------------------------------
create or replace function public.mark_present(
  p_court_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns public.court_presence
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_court public.courts;
  v_max int := public.setting_int('presence_max_distance_m', 500);
  v_minutes int := public.setting_int('presence_minutes', 30);
  v_row public.court_presence;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_court from public.courts where id = p_court_id and status = 'approved';
  if not found then
    raise exception 'court_not_available' using errcode = 'P0001';
  end if;

  if v_max > 0 then
    if p_latitude is null or p_longitude is null then
      raise exception 'location_required' using errcode = 'P0001';
    end if;
    if public.distance_m(p_latitude, p_longitude, v_court.latitude, v_court.longitude) > v_max then
      raise exception 'too_far_from_court' using errcode = 'P0001';
    end if;
  end if;

  -- Already here: just refresh.
  update public.court_presence
  set last_seen = now(),
      expires_at = now() + make_interval(mins => v_minutes),
      warned_at = null,
      latitude = p_latitude,
      longitude = p_longitude
  where user_id = v_uid and court_id = p_court_id and status = 'active'
  returning * into v_row;
  if found then
    return v_row;
  end if;

  -- Checked in somewhere else: close that first.
  update public.court_presence
  set status = 'left', ended_at = now()
  where user_id = v_uid and status = 'active';

  insert into public.court_presence (user_id, court_id, latitude, longitude, expires_at)
  values (v_uid, p_court_id, p_latitude, p_longitude, now() + make_interval(mins => v_minutes))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.confirm_presence()
returns public.court_presence
language plpgsql
set search_path = public
as $$
declare
  v_row public.court_presence;
begin
  update public.court_presence
  set last_seen = now(),
      expires_at = now() + make_interval(mins => public.setting_int('presence_minutes', 30)),
      warned_at = null
  where user_id = app_uid() and status = 'active' and expires_at > now()
  returning * into v_row;
  if not found then
    raise exception 'no_active_presence' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

create or replace function public.end_presence()
returns void
language sql
set search_path = public
as $$
  update public.court_presence
  set status = 'left', ended_at = now()
  where user_id = app_uid() and status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- Discovery
-- ---------------------------------------------------------------------------
create or replace function public.courts_near(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision default 25,
  p_sport_slug text default null
)
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  address text,
  photos text[],
  opening_hours text,
  lighting boolean,
  surface text,
  sport_slugs text[],
  distance_m double precision,
  player_count int,
  active_game_count int,
  activity public.court_activity,
  last_activity_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select c.id, c.name, c.latitude, c.longitude, c.address, c.photos,
         c.opening_hours, c.lighting, c.surface,
         array(
           select s.slug from public.court_sports cs
           join public.sports s on s.id = cs.sport_id
           where cs.court_id = c.id order by s.sort_order
         ),
         public.distance_m(p_latitude, p_longitude, c.latitude, c.longitude) as distance_m,
         coalesce(st.player_count, 0),
         coalesce(st.active_game_count, 0),
         coalesce(st.activity, 'inactive'),
         st.last_activity_at
  from public.courts c
  left join public.court_live_stats st on st.court_id = c.id
  where c.status = 'approved'
    -- Cheap bounding box first, exact distance second.
    and c.latitude between p_latitude - p_radius_km / 111.0 and p_latitude + p_radius_km / 111.0
    and public.distance_m(p_latitude, p_longitude, c.latitude, c.longitude) <= p_radius_km * 1000
    and (
      p_sport_slug is null or exists (
        select 1 from public.court_sports cs join public.sports s on s.id = cs.sport_id
        where cs.court_id = c.id and s.slug = p_sport_slug
      )
    )
  order by distance_m
  limit 500;
$$;

-- Coarse area for activity alerts; rounded so it never reveals an exact spot.
create or replace function public.set_notify_area(p_latitude double precision, p_longitude double precision)
returns void
language sql
set search_path = public
as $$
  update public.users
  set notify_lat = round(p_latitude::numeric, 2),
      notify_lng = round(p_longitude::numeric, 2)
  where id = app_uid();
$$;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language sql
set search_path = public
as $$
  insert into public.push_tokens (user_id, token, platform)
  values (app_uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

create or replace function public.profile_stats(p_user_id uuid)
returns table (games_played int, games_created int)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::int from public.game_players gp
       join public.games g on g.id = gp.game_id
     where gp.user_id = p_user_id and gp.status = 'joined'
       and g.status in ('active', 'completed')),
    (select count(*)::int from public.games
     where creator_id = p_user_id and status <> 'cancelled');
$$;

-- ---------------------------------------------------------------------------
-- Lifecycle tick (run every minute by pg_cron)
-- ---------------------------------------------------------------------------
create or replace function public.tick()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_started int;
  v_completed int;
  v_expired int;
  v_warned int;
  v_reminded int;
  v_alerts int;
  v_warn int := public.setting_int('presence_warning_minutes', 5);
  v_remind int := public.setting_int('game_reminder_minutes', 30);
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_cooldown int := public.setting_int('activity_alert_cooldown_min', 120);
begin
  -- 1. Game lifecycle
  update public.games set status = 'active'
  where status = 'scheduled' and start_time <= now();
  get diagnostics v_started = row_count;

  update public.games set status = 'completed'
  where status = 'active' and start_time + make_interval(mins => duration_minutes) <= now();
  get diagnostics v_completed = row_count;

  -- 2. Presence expiry (the trigger refreshes court stats)
  update public.court_presence set status = 'expired', ended_at = now()
  where status = 'active' and expires_at <= now();
  get diagnostics v_expired = row_count;

  -- 3. "Are you still playing?" (in-app row; the device shows a local
  --    notification scheduled at check-in, so no remote push here)
  with due as (
    update public.court_presence p set warned_at = now()
    where p.status = 'active' and p.warned_at is null
      and p.expires_at - make_interval(mins => v_warn) <= now()
    returning p.id, p.user_id, p.court_id, p.expires_at
  )
  insert into public.notifications (user_id, type, title, body, data, push, dedupe_key)
  select d.user_id, 'presence_check', 'Are you still playing?',
         'Are you still playing at ' || c.name || '?',
         jsonb_build_object('court_id', d.court_id, 'presence_id', d.id),
         false, 'presence:' || d.id || ':' || extract(epoch from d.expires_at)::bigint
  from due d join public.courts c on c.id = d.court_id
  on conflict (dedupe_key) do nothing;
  get diagnostics v_warned = row_count;

  -- 4. Game reminders
  with due as (
    update public.game_players gp set reminded_at = now()
    from public.games g
    where g.id = gp.game_id and gp.status = 'joined' and gp.reminded_at is null
      and g.status = 'scheduled'
      and g.start_time > now()
      and g.start_time <= now() + make_interval(mins => v_remind)
    returning gp.user_id, g.id as game_id, g.court_id, g.sport_id, g.start_time
  )
  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select d.user_id, 'game_reminder', 'Game reminder',
         s.icon || ' Your game at ' || c.name || ' starts in ' ||
           greatest(1, ceil(extract(epoch from d.start_time - now()) / 60))::int || ' minutes.',
         jsonb_build_object('game_id', d.game_id, 'court_id', d.court_id),
         'reminder:' || d.game_id || ':' || d.user_id
  from due d
  join public.courts c on c.id = d.court_id
  join public.sports s on s.id = d.sport_id
  on conflict (dedupe_key) do nothing;
  get diagnostics v_reminded = row_count;

  -- 5. "A game is active near you" — uses only the coarse notify area.
  with newly_active as (
    update public.court_live_stats st set announced_at = now()
    where st.activity = 'active'
      and st.became_active_at is not null
      and (st.announced_at is null or st.announced_at < st.became_active_at)
    returning st.court_id
  )
  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select p.id, 'game_activity', 'Game on nearby',
         coalesce((
           select s.icon from public.court_sports cs join public.sports s on s.id = cs.sport_id
           where cs.court_id = c.id order by s.sort_order limit 1
         ), '🔥') || ' A game is active ' ||
           round((public.distance_m(p.notify_lat, p.notify_lng, c.latitude, c.longitude) / 1000)::numeric, 1)
           || ' km from you at ' || c.name || '.',
         jsonb_build_object('court_id', c.id),
         'activity:' || c.id || ':' || p.id || ':' ||
           (extract(epoch from now())::bigint / (v_cooldown * 60))
  from newly_active na
  join public.courts c on c.id = na.court_id
  join public.users p on p.notify_lat is not null and p.suspended_at is null
  where public.distance_m(p.notify_lat, p.notify_lng, c.latitude, c.longitude) <= v_radius * 1000
    and not exists (
      select 1 from public.court_presence cp
      where cp.user_id = p.id and cp.court_id = c.id and cp.status = 'active'
    )
    and not exists (
      select 1 from public.game_players gp join public.games g on g.id = gp.game_id
      where gp.user_id = p.id and g.court_id = c.id and g.status = 'active' and gp.status = 'joined'
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = p.id and n.type = 'game_activity'
        and n.data ->> 'court_id' = c.id::text
        and n.created_at > now() - make_interval(mins => v_cooldown)
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics v_alerts = row_count;

  return jsonb_build_object(
    'games_started', v_started, 'games_completed', v_completed,
    'presence_expired', v_expired, 'presence_warned', v_warned,
    'reminders', v_reminded, 'activity_alerts', v_alerts
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_review_court(
  p_court_id uuid, p_approve boolean, p_reason text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_admin();
  update public.courts
  set status = case when p_approve then 'approved' else 'rejected' end::public.court_status,
      rejection_reason = case when p_approve then null else nullif(trim(p_reason), '') end,
      reviewed_by = app_uid(),
      reviewed_at = now()
  where id = p_court_id;
  if not found then
    raise exception 'court_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid, p_status public.report_status, p_note text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_admin();
  update public.reports
  set status = p_status,
      admin_note = nullif(trim(p_note), ''),
      resolved_by = case when p_status = 'open' then null else app_uid() end,
      resolved_at = case when p_status = 'open' then null else now() end
  where id = p_report_id;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_admin();
  if p_user_id = app_uid() then
    raise exception 'cannot_suspend_self' using errcode = 'P0001';
  end if;
  update public.users
  set suspended_at = case when p_suspended then now() end
  where id = p_user_id;
  if p_suspended then
    update public.court_presence set status = 'left', ended_at = now()
    where user_id = p_user_id and status = 'active';
  end if;
end;
$$;

create or replace function public.admin_list_users(p_search text default null, p_limit int default 50)
returns table (
  id uuid, first_name text, last_name text, username text, email text,
  avatar_url text, role public.user_role, suspended_at timestamptz, created_at timestamptz
)
language plpgsql
stable
set search_path = public
as $$
begin
  perform public.assert_admin();
  return query
  select p.id, p.first_name, p.last_name, p.username::text, p.email::text,
         p.avatar_url, p.role, p.suspended_at, p.created_at
  from public.users p
  where p_search is null or p_search = ''
     or p.username ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
     or (p.first_name || ' ' || p.last_name) ilike '%' || p_search || '%'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'total_users', (select count(*) from public.users),
    'active_users', (
      select count(distinct user_id) from (
        select user_id from public.court_presence where started_at > now() - interval '7 days'
        union
        select user_id from public.game_players where joined_at > now() - interval '7 days'
      ) a
    ),
    'active_now', (select coalesce(sum(player_count), 0) from public.court_live_stats),
    'courts', (select count(*) from public.courts where status = 'approved'),
    'pending_courts', (select count(*) from public.courts where status = 'pending'),
    'games', (select count(*) from public.games),
    'games_today', (select count(*) from public.games where start_time::date = now()::date),
    'active_games', (select count(*) from public.games where status = 'active'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'most_active_courts', coalesce((
      select jsonb_agg(t order by t.visits desc)
      from (
        select c.id, c.name, count(*) as visits
        from (
          select court_id from public.court_presence where started_at > now() - interval '30 days'
          union all
          select g.court_id from public.game_players gp join public.games g on g.id = gp.game_id
          where gp.joined_at > now() - interval '30 days'
        ) x
        join public.courts c on c.id = x.court_id
        group by c.id, c.name
        order by visits desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
