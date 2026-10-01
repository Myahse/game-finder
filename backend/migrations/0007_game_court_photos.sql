-- Include court photos on game payloads (map cards, game detail).

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
    'spots_left', greatest(g.max_players - pc.n, 0),
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
