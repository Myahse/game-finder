-- Live (active) games require the player to be at the court. Scheduled games can be joined remotely.

create or replace function public.assert_at_court(
  p_court_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
set search_path = public
as $fn$
declare
  v_court public.courts;
  v_max int := public.setting_int('presence_max_distance_m', 500);
begin
  select * into v_court from public.courts where id = p_court_id;
  if not found then
    raise exception 'court_not_found' using errcode = 'P0001';
  end if;

  if v_max > 0 then
    if p_latitude is null or p_longitude is null then
      raise exception 'location_required' using errcode = 'P0001';
    end if;
    if public.distance_m(p_latitude, p_longitude, v_court.latitude, v_court.longitude) > v_max then
      raise exception 'too_far_from_court' using errcode = 'P0001';
    end if;
  end if;
end;
$fn$;

create or replace function public.join_game(
  p_game_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns int
language plpgsql
set search_path = public
as $fn$
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

  if v_game.status = 'active' then
    perform public.assert_at_court(v_game.court_id, p_latitude, p_longitude);
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
$fn$;
