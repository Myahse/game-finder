-- max_players = 0 means no cap on joins.

alter table public.games drop constraint if exists games_max_players_check;
alter table public.games add constraint games_max_players_check
  check (max_players = 0 or max_players between 2 and 50);

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
  if v_game.max_players > 0 and v_count >= v_game.max_players then
    raise exception 'game_full' using errcode = 'P0001';
  end if;

  insert into public.game_players (game_id, user_id, status, joined_at, left_at)
  values (p_game_id, v_uid, 'joined', now(), null)
  on conflict (game_id, user_id) do update
    set status = 'joined', joined_at = now(), left_at = null, reminded_at = null;

  return v_count + 1;
end;
$$;

create or replace function public.trg_game_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_joined int;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.courts
      where id = new.court_id and public.court_is_playable(status)
    ) then
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
    if app_uid() is not null and not public.is_admin()
       and (new.court_id <> old.court_id or new.creator_id is distinct from old.creator_id) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    if new.max_players <> old.max_players then
      select count(*) into v_joined from public.game_players
      where game_id = new.id and status = 'joined';
      if new.max_players > 0 and new.max_players < v_joined then
        raise exception 'max_players_below_current' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.game_json(g public.games, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', g.id,
    'court_id', g.court_id,
    'sport_id', g.sport_id,
    'creator_id', g.creator_id,
    'start_time', g.start_time,
    'duration_minutes', g.duration_minutes,
    'max_players', g.max_players,
    'skill_level', g.skill_level,
    'game_type', g.game_type,
    'status', g.status,
    'cancelled_reason', g.cancelled_reason,
    'created_at', g.created_at,
    'player_count', pc.n,
    'spots_left', case when g.max_players = 0 then null else greatest(g.max_players - pc.n, 0) end,
    'joined', exists (
      select 1 from public.game_players gp
      where gp.game_id = g.id and gp.user_id = app_uid() and gp.status = 'joined'
    ),
    'court', jsonb_build_object(
      'id', c.id, 'name', c.name, 'latitude', c.latitude, 'longitude', c.longitude,
      'address', c.address, 'photos', c.photos
    ),
    'sport', public.sport_json(s),
    'creator', (select public.user_public_json(u) from public.users u where u.id = g.creator_id),
    'distance_m', case when p_lat is not null and p_lng is not null
      then round(public.distance_m(p_lat, p_lng, c.latitude, c.longitude)) end
  )
  from public.courts c, public.sports s,
       lateral (
         select count(*)::int as n from public.game_players
         where game_id = g.id and status = 'joined'
       ) pc
  where c.id = g.court_id and s.id = g.sport_id;
$$;
