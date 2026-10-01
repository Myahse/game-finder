-- Find the Game — API response shapes
-- JSON builders used by the Go handlers so every client sees one shape.

create or replace function public.user_public_json(u public.users)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
    'username', u.username, 'avatar_url', u.avatar_url,
    'preferred_sport_id', u.preferred_sport_id, 'skill_level', u.skill_level,
    'created_at', u.created_at
  );
$$;

create or replace function public.sport_json(s public.sports)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'icon', s.icon, 'active', s.active);
$$;

-- p_lat/p_lng are the viewer's position; used only to compute distance.
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
      'id', c.id, 'name', c.name, 'latitude', c.latitude, 'longitude', c.longitude, 'address', c.address
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

create or replace function public.court_json(c public.courts, p_lat double precision default null, p_lng double precision default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'latitude', c.latitude,
    'longitude', c.longitude,
    'address', c.address,
    'description', c.description,
    'photos', c.photos,
    'opening_hours', c.opening_hours,
    'lighting', c.lighting,
    'surface', c.surface,
    'status', c.status,
    'rejection_reason', c.rejection_reason,
    'created_by', c.created_by,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'sports', coalesce((
      select jsonb_agg(public.sport_json(s) order by s.sort_order)
      from public.court_sports cs join public.sports s on s.id = cs.sport_id
      where cs.court_id = c.id
    ), '[]'::jsonb),
    'player_count', coalesce(st.player_count, 0),
    'active_game_count', coalesce(st.active_game_count, 0),
    'activity', coalesce(st.activity, 'inactive'),
    'last_activity_at', st.last_activity_at,
    'distance_m', case when p_lat is not null and p_lng is not null
      then round(public.distance_m(p_lat, p_lng, c.latitude, c.longitude)) end
  )
  from (select 1) one
  left join public.court_live_stats st on st.court_id = c.id;
$$;

-- "I want to play": live games and games starting soon, nearest first.
create or replace function public.games_nearby(
  p_lat double precision, p_lng double precision,
  p_radius_km double precision default 25, p_sport_slug text default null,
  p_upcoming_hours int default 3
)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(j order by (j ->> 'distance_m')::float), '[]'::jsonb)
  from (
    select public.game_json(g, p_lat, p_lng) as j
    from public.games g
    join public.courts c on c.id = g.court_id and c.status = 'approved'
    join public.sports s on s.id = g.sport_id
    where (g.status = 'active'
           or (g.status = 'scheduled' and g.start_time <= now() + make_interval(hours => p_upcoming_hours)))
      and (p_sport_slug is null or s.slug = p_sport_slug)
      and c.latitude between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
      and public.distance_m(p_lat, p_lng, c.latitude, c.longitude) <= p_radius_km * 1000
    limit 200
  ) x;
$$;
