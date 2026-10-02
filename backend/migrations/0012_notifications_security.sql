create extension if not exists pgcrypto;

-- Notification policy:
--   court_added: only when a court is APPROVED (not on pending user proposals).
--   game_created: nearby users; bodies use notification_safe_text (no newlines / length cap).
--   WS: one-time connect tickets (no long-lived JWT in query strings).

create or replace function public.notification_safe_text(p text, p_max int default 60)
returns text
language sql
immutable
set search_path = public
as $$
  select left(regexp_replace(coalesce(trim(p), ''), E'[\\n\\r\\t]+', ' ', 'g'), p_max);
$$;

-- ---------------------------------------------------------------------------
-- court_added: approved courts only (admin approve or direct approved insert)
-- ---------------------------------------------------------------------------
drop trigger if exists courts_notify_added on public.courts;

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
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'approved' then
    return null;
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
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists courts_notify_approved on public.courts;
create trigger courts_notify_approved
  after insert or update of status on public.courts
  for each row execute function public.trg_notify_court_approved();

-- ---------------------------------------------------------------------------
-- game_created: sanitized copy
-- ---------------------------------------------------------------------------
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
  on conflict (dedupe_key) do nothing;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- One-time WebSocket connect tickets (hashed at rest)
-- ---------------------------------------------------------------------------
create table if not exists public.ws_tickets (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists ws_tickets_expires_idx on public.ws_tickets (expires_at);

create or replace function public.issue_ws_ticket()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_raw text;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  v_raw := encode(gen_random_bytes(32), 'base64');
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  insert into public.ws_tickets (token_hash, user_id, expires_at)
  values (v_hash, v_uid, now() + interval '2 minutes');
  return v_raw;
end;
$$;

create or replace function public.consume_ws_ticket(p_raw text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_hash text := encode(digest(p_raw, 'sha256'), 'hex');
  v_uid uuid;
begin
  delete from public.ws_tickets
  where token_hash = v_hash and expires_at > now()
  returning user_id into v_uid;
  return v_uid;
end;
$$;
