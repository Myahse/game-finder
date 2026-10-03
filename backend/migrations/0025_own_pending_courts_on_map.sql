-- Proposers see their own pending courts on the map; everyone else still sees approved only.

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
  where (
      public.court_is_playable(c.status)
      or (c.status = 'pending' and c.created_by = app_uid())
    )
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
