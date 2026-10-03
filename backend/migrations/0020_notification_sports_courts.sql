-- Alert users for nearby courts/games/invites when those events match their sports.

create or replace function public.user_sport_ids(p_user_id uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select u.preferred_sport_id
  from public.users u
  where u.id = p_user_id and u.preferred_sport_id is not null
  union
  select ues.sport_id from public.user_extra_sports ues where ues.user_id = p_user_id;
$$;

create or replace function public.user_matches_sport(p_user_id uuid, p_sport_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.user_sport_ids(p_user_id) s where s = p_sport_id);
$$;

create or replace function public.user_matches_court(p_user_id uuid, p_court_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.court_sports cs
    where cs.court_id = p_court_id
      and cs.sport_id in (select public.user_sport_ids(p_user_id))
  );
$$;

-- Nearby courts: pending or approved when they first hit the map; approved after rejection.
create or replace function public.trg_notify_court_approved()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_name text;
  v_should_notify boolean := false;
begin
  if not public.court_is_playable(new.status) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_notify := true;
  elsif tg_op = 'UPDATE' then
    if old.status = new.status then
      return new;
    end if;
    -- Already alerted when the court was proposed (pending).
    if old.status in ('pending', 'approved') and new.status = 'approved' then
      return new;
    end if;
    v_should_notify := new.status = 'approved';
  end if;

  if not v_should_notify then
    return new;
  end if;

  v_name := public.notification_safe_text(new.name, 80);

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'court_added',
    case when new.status = 'pending' then 'New court proposed nearby' else 'New court nearby' end,
    case
      when new.status = 'pending' then
        v_name || ' was added to the map ('
      else
        v_name || ' is now on the map ('
    end
      || round((public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) / 1000)::numeric, 1)
      || ' km away).',
    jsonb_build_object('court_id', new.id),
    'court_added:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.id is distinct from new.created_by
    and exists (select 1 from public.user_sport_ids(p.id))
    and public.user_matches_court(p.id, new.id)
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
    and exists (select 1 from public.user_sport_ids(p.id))
    and public.user_matches_sport(p.id, new.sport_id)
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
  v_place text;
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

  select public.notification_safe_text(coalesce(nullif(trim(p.first_name), ''), p.username::text), 32)
  into v_inviter
  from public.users p where p.id = v_uid;

  select lower(public.notification_safe_text(s.name, 24)), g.court_id
  into v_sport, v_court
  from public.games g join public.sports s on s.id = g.sport_id where g.id = p_game_id;

  select public.notification_safe_text(c.name, 60) into v_place from public.courts c where c.id = v_court;

  insert into public.notifications (user_id, type, title, body, data, push, dedupe_key)
  values (
    v_invitee,
    'game_invite',
    'Game invitation',
    v_inviter || ' invited you to a ' || coalesce(v_sport, 'pickup') || ' game at ' || coalesce(v_place, 'a court') || '.',
    jsonb_build_object('game_id', p_game_id, 'court_id', v_court),
    true,
    'invite:' || p_game_id::text || ':' || v_invitee::text
  )
  on conflict (dedupe_key) do update set
    title = excluded.title,
    body = excluded.body,
    data = excluded.data,
    push = true,
    read = false,
    created_at = now(),
    pushed_at = null;
end;
$$;
