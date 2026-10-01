-- User-submitted courts stay on the map (pending) so others can find them and start games.
-- Admin review still applies; rejected courts stay hidden.

create or replace function public.court_is_playable(p_status public.court_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('approved', 'pending');
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
      if new.max_players < v_joined then
        raise exception 'max_players_below_current' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

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
  where public.court_is_playable(c.status)
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
    join public.courts c on c.id = g.court_id and public.court_is_playable(c.status)
    join public.sports s on s.id = g.sport_id
    where (g.status = 'active'
           or (g.status = 'scheduled' and g.start_time <= now() + make_interval(hours => p_upcoming_hours)))
      and (p_sport_slug is null or s.slug = p_sport_slug)
      and c.latitude between p_lat - p_radius_km / 111.0 and p_lat + p_radius_km / 111.0
      and public.distance_m(p_lat, p_lng, c.latitude, c.longitude) <= p_radius_km * 1000
    limit 200
  ) x;
$$;

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
    return v_row;
  end if;

  update public.court_presence
  set status = 'left', ended_at = now()
  where user_id = v_uid and status = 'active';

  insert into public.court_presence (user_id, court_id, latitude, longitude, expires_at)
  values (v_uid, p_court_id, p_latitude, p_longitude, now() + make_interval(mins => v_minutes))
  returning * into v_row;
  return v_row;
end;
$$;
