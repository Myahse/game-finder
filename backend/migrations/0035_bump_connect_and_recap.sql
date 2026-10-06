-- Bump to connect: two players tap "Connect" at the same time, close together → friends.
-- Monthly recap: per-player stats for a calendar month.

create table if not exists public.friend_bumps (
  user_id uuid primary key references public.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now(),
  -- Set on the *other* player's row when someone matches them, so their next poll sees it.
  matched_user uuid references public.users (id) on delete cascade,
  matched_at timestamptz
);

create index if not exists friend_bumps_recent_idx on public.friend_bumps (created_at) where matched_user is null;

-- How close in time (s) and space (m) two taps must be to count as a bump.
create or replace function public.bump_window_secs() returns int language sql immutable as $$ select 12 $$;
create or replace function public.bump_radius_m() returns int language sql immutable as $$ select 150 $$;

create or replace function public.bump_connect(p_latitude double precision, p_longitude double precision)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_other uuid;
  v_already boolean := false;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  -- Someone matched me while I was waiting.
  select matched_user into v_other
  from friend_bumps
  where user_id = v_uid and matched_user is not null and matched_at > now() - interval '60 seconds';
  if v_other is not null then
    delete from friend_bumps where user_id = v_uid;
    return jsonb_build_object('status', 'matched', 'friend', (select user_public_json(u) from users u where u.id = v_other));
  end if;

  -- Keep my tap fresh while I wait (each poll re-arms it).
  insert into friend_bumps (user_id, latitude, longitude, created_at)
  values (v_uid, p_latitude, p_longitude, now())
  on conflict (user_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    created_at = now(),
    matched_user = null,
    matched_at = null;

  -- Nearest other fresh tap.
  select b.user_id into v_other
  from friend_bumps b
  join users u on u.id = b.user_id
  where b.user_id <> v_uid
    and b.matched_user is null
    and b.created_at > now() - make_interval(secs => bump_window_secs())
    and u.suspended_at is null
    and distance_m(p_latitude, p_longitude, b.latitude, b.longitude) <= bump_radius_m()
  order by distance_m(p_latitude, p_longitude, b.latitude, b.longitude), b.created_at desc
  limit 1
  for update of b skip locked;

  if v_other is null then
    -- Tidy old taps now and then.
    delete from friend_bumps where created_at < now() - interval '10 minutes';
    return jsonb_build_object('status', 'waiting');
  end if;

  -- Serialize the pair so two simultaneous matches can't create two friend rows.
  perform pg_advisory_xact_lock(hashtext('bump:' || least(v_uid, v_other)::text || greatest(v_uid, v_other)::text));

  select exists (
    select 1 from friend_links
    where status = 'accepted'
      and ((requester_id = v_uid and addressee_id = v_other) or (requester_id = v_other and addressee_id = v_uid))
  ) into v_already;

  if not v_already then
    update friend_links set status = 'accepted', responded_at = now()
    where (requester_id = v_uid and addressee_id = v_other) or (requester_id = v_other and addressee_id = v_uid);
    if not found then
      insert into friend_links (requester_id, addressee_id, status, responded_at)
      values (v_uid, v_other, 'accepted', now())
      on conflict (requester_id, addressee_id) do update set status = 'accepted', responded_at = now();
    end if;

    select notification_safe_text(coalesce(nullif(trim(first_name), ''), username::text), 40)
    into v_name from users where id = v_uid;
    insert into notifications (user_id, type, title, body, data, dedupe_key, push)
    values (
      v_other, 'friend_accepted', 'New friend', v_name || ' connected with you on court.',
      jsonb_build_object('user_id', v_uid),
      'bump:' || v_uid::text || ':' || v_other::text || ':' || to_char(now(), 'YYYYMMDDHH24MI'),
      false
    )
    on conflict (dedupe_key) do nothing;
  end if;

  update friend_bumps set matched_user = v_uid, matched_at = now() where user_id = v_other;
  delete from friend_bumps where user_id = v_uid;

  return jsonb_build_object(
    'status', 'matched',
    'already_friends', v_already,
    'friend', (select user_public_json(u) from users u where u.id = v_other)
  );
end;
$$;

create or replace function public.bump_cancel()
returns void
language sql
set search_path = public
as $$
  delete from friend_bumps where user_id = app_uid() and matched_user is null;
$$;

-- ---------------------------------------------------------------------------
-- Monthly recap for the signed-in player. p_month = any date inside the month.
-- "Showed up" = a joined game where the player checked in at that court around game time.
-- ---------------------------------------------------------------------------
create or replace function public.my_monthly_recap(p_month date)
returns jsonb
language sql
stable
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', p_month)::timestamptz as m_start,
           (date_trunc('month', p_month) + interval '1 month')::timestamptz as m_end
  ),
  my_games as (
    select g.id, g.court_id, g.sport_id, g.start_time, g.duration_minutes
    from game_players gp
    join games g on g.id = gp.game_id
    cross join bounds b
    where gp.user_id = app_uid()
      and gp.status = 'joined'
      and g.status <> 'cancelled'
      and g.start_time >= b.m_start and g.start_time < least(b.m_end, now())
  ),
  showed as (
    select mg.id
    from my_games mg
    where exists (
      select 1 from court_presence p
      where p.user_id = app_uid()
        and p.court_id = mg.court_id
        and p.started_at < mg.start_time + make_interval(mins => mg.duration_minutes)
        and coalesce(p.ended_at, p.expires_at) > mg.start_time - interval '30 minutes'
    )
  ),
  check_ins as (
    select p.court_id
    from court_presence p cross join bounds b
    where p.user_id = app_uid() and p.started_at >= b.m_start and p.started_at < b.m_end
  ),
  teammate as (
    select gp.user_id, count(*) as games
    from game_players gp
    join my_games mg on mg.id = gp.game_id
    join users u on u.id = gp.user_id
    where gp.user_id <> app_uid() and gp.status = 'joined' and u.suspended_at is null
    group by gp.user_id
    order by count(*) desc, max(mg.start_time) desc
    limit 1
  ),
  top_court as (
    select c.id, c.name, count(*) as visits
    from (select court_id from my_games union all select court_id from check_ins) v
    join courts c on c.id = v.court_id
    group by c.id, c.name
    order by count(*) desc
    limit 1
  )
  select jsonb_build_object(
    'month', to_char((select m_start from bounds), 'YYYY-MM'),
    'games', (select count(*) from my_games),
    'hours', round(coalesce((select sum(duration_minutes) from my_games), 0) / 60.0, 1),
    'courts', (select count(distinct court_id) from (select court_id from my_games union select court_id from check_ins) c),
    'check_ins', (select count(*) from check_ins),
    'showed_up', (select count(*) from showed),
    'show_up_pct', case when (select count(*) from my_games) = 0 then null
                        else round(100.0 * (select count(*) from showed) / (select count(*) from my_games)) end,
    'games_created', (select count(*) from games g cross join bounds b
                      where g.creator_id = app_uid() and g.status <> 'cancelled'
                        and g.start_time >= b.m_start and g.start_time < b.m_end),
    'top_court', (select jsonb_build_object('id', id, 'name', name, 'visits', visits) from top_court),
    'top_teammate', (select jsonb_build_object('user', user_public_json(u), 'games', t.games)
                     from teammate t join users u on u.id = t.user_id)
  );
$$;
