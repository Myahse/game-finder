-- Anti-abuse: verified notify area, browse location checks, pending court caps, alert throttles.

alter table public.users
  add column if not exists notify_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- Notify area: coarse GPS from client, but not arbitrary teleports.
-- Anchored to a recent court check-in, or small moves / infrequent jumps.
-- ---------------------------------------------------------------------------
create or replace function public.set_notify_area(p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_old_lat double precision;
  v_old_lng double precision;
  v_updated timestamptz;
  v_dist double precision;
  v_presence_near boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'invalid_location' using errcode = 'P0001';
  end if;

  select notify_lat::float8, notify_lng::float8, notify_updated_at
  into v_old_lat, v_old_lng, v_updated
  from public.users where id = v_uid;

  if v_old_lat is null then
    update public.users
    set notify_lat = round(p_latitude::numeric, 2),
        notify_lng = round(p_longitude::numeric, 2),
        notify_updated_at = now()
    where id = v_uid;
    return;
  end if;

  v_dist := public.distance_m(v_old_lat, v_old_lng, p_latitude, p_longitude);

  select exists (
    select 1 from public.court_presence cp
    where cp.user_id = v_uid
      and cp.latitude is not null
      and cp.longitude is not null
      and cp.started_at > now() - interval '30 days'
      and public.distance_m(cp.latitude, cp.longitude, p_latitude, p_longitude) <= 30000
  ) into v_presence_near;

  if v_presence_near then
    update public.users
    set notify_lat = round(p_latitude::numeric, 2),
        notify_lng = round(p_longitude::numeric, 2),
        notify_updated_at = now()
    where id = v_uid;
    return;
  end if;

  if v_dist <= 5000 then
    null;
  elsif v_dist > 150000 then
    raise exception 'notify_jump_too_far' using errcode = 'P0001';
  elsif v_updated is not null and v_updated > now() - interval '15 minutes' then
    raise exception 'notify_rate_limited' using errcode = 'P0001';
  end if;

  update public.users
  set notify_lat = round(p_latitude::numeric, 2),
      notify_lng = round(p_longitude::numeric, 2),
      notify_updated_at = now()
  where id = v_uid;
end;
$$;

-- Sync alert zone when user checks in (GPS already validated at the court).
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

  select * into v_court from public.courts where id = p_court_id and public.court_is_playable(status);
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

  update public.court_presence
  set last_seen = now(),
      expires_at = now() + make_interval(mins => v_minutes),
      warned_at = null,
      latitude = p_latitude,
      longitude = p_longitude
  where user_id = v_uid and court_id = p_court_id and status = 'active'
  returning * into v_row;
  if found then
    update public.users
    set notify_lat = round(p_latitude::numeric, 2),
        notify_lng = round(p_longitude::numeric, 2),
        notify_updated_at = now()
    where id = v_uid;
    return v_row;
  end if;

  update public.court_presence
  set status = 'left', ended_at = now()
  where user_id = v_uid and status = 'active';

  insert into public.court_presence (user_id, court_id, latitude, longitude, expires_at)
  values (v_uid, p_court_id, p_latitude, p_longitude, now() + make_interval(mins => v_minutes))
  returning * into v_row;

  update public.users
  set notify_lat = round(p_latitude::numeric, 2),
      notify_lng = round(p_longitude::numeric, 2),
      notify_updated_at = now()
  where id = v_uid;

  return v_row;
end;
$$;

-- Signed-in map browse must be near home alert zone or a recent check-in.
create or replace function public.assert_browse_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_nlat double precision;
  v_nlng double precision;
begin
  if v_uid is null then
    return;
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  select notify_lat::float8, notify_lng::float8 into v_nlat, v_nlng
  from public.users where id = v_uid;

  if v_nlat is not null and public.distance_m(v_nlat, v_nlng, p_lat, p_lng) <= 200000 then
    return;
  end if;

  if exists (
    select 1 from public.court_presence cp
    where cp.user_id = v_uid
      and cp.latitude is not null
      and cp.started_at > now() - interval '14 days'
      and public.distance_m(cp.latitude, cp.longitude, p_lat, p_lng) <= 50000
  ) then
    return;
  end if;

  if v_nlat is null then
    return;
  end if;

  raise exception 'browse_location_mismatch' using errcode = 'P0001';
end;
$$;

-- Cap pending court proposals per user.
create or replace function public.trg_court_pending_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pending int;
begin
  if app_uid() is null or public.is_admin() then
    return new;
  end if;
  select count(*) into v_pending
  from public.courts
  where created_by = app_uid() and status = 'pending';
  if v_pending >= 3 then
    raise exception 'too_many_pending_courts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists courts_pending_cap on public.courts;
create trigger courts_pending_cap
  before insert on public.courts
  for each row execute function public.trg_court_pending_cap();

-- Per-recipient cap on nearby alert volume (game + court).
create or replace function public.trg_notify_game_created()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_court public.courts;
  v_sport text;
  v_creator text;
  v_place text;
begin
  select * into v_court from public.courts where id = new.court_id;
  if not found or not public.court_is_playable(v_court.status) then
    return null;
  end if;

  select lower(public.notification_safe_text(s.name, 24)) into v_sport from public.sports s where s.id = new.sport_id;

  if new.creator_id is not null then
    select public.notification_safe_text(coalesce(nullif(trim(first_name), ''), username::text), 32)
    into v_creator
    from public.users where id = new.creator_id;
  end if;

  v_place := public.notification_safe_text(v_court.name, 60);

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'game_created',
    'New game nearby',
    coalesce(v_creator || ' started a ', 'New ') || coalesce(v_sport, 'pickup') || ' game at ' || v_place
      || ' (' || round((public.distance_m(p.notify_lat, p.notify_lng, v_court.latitude, v_court.longitude) / 1000)::numeric, 1) || ' km).',
    jsonb_build_object('game_id', new.id, 'court_id', new.court_id),
    'game_created:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.id is distinct from new.creator_id
    and public.distance_m(p.notify_lat, p.notify_lng, v_court.latitude, v_court.longitude) <= v_radius * 1000
    and (
      select count(*) from public.notifications n
      where n.user_id = p.id
        and n.type in ('game_created', 'court_added')
        and n.created_at > now() - interval '1 hour'
    ) < 12
  on conflict (dedupe_key) do nothing;

  return null;
end;
$$;

create or replace function public.trg_notify_court_approved()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_name text;
begin
  if new.status <> 'approved' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then
    return new;
  end if;

  v_name := public.notification_safe_text(new.name, 80);

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'court_added',
    'New court nearby',
    v_name || ' is now on the map ('
      || round((public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) / 1000)::numeric, 1)
      || ' km away).',
    jsonb_build_object('court_id', new.id),
    'court_added:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.id is distinct from new.created_by
    and public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) <= v_radius * 1000
    and (
      select count(*) from public.notifications n
      where n.user_id = p.id
        and n.type in ('game_created', 'court_added')
        and n.created_at > now() - interval '1 hour'
    ) < 12
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;
