-- Admin usage analytics: who is active, which features get used and whether
-- it is growing. One call returns everything the admin "Usage" page needs.
--
-- "Active" means the player did something meaningful on the server: created
-- or joined a game, checked in at a court, sent/answered a challenge, moved a
-- game to another court, filled a scoreboard, proposed a court, filed a
-- report, sent/answered a friend request or bumped phones. Opening the app
-- (a refresh token being issued) is reported separately as `app_opens`.

-- Time-range scans used by admin_usage(); the tables are small but these keep
-- the function cheap as they grow.
create index if not exists games_created_at_idx on public.games (created_at);
create index if not exists game_players_joined_at_idx on public.game_players (joined_at);
create index if not exists court_presence_started_at_idx on public.court_presence (started_at);
create index if not exists challenges_created_at_idx on public.challenges (created_at);
create index if not exists users_created_at_idx on public.users (created_at);
create index if not exists refresh_tokens_created_at_idx on public.refresh_tokens (created_at);

create or replace function public.admin_usage(p_days int)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_now timestamptz := now();
  v_today date := (now() at time zone 'utc')::date;
  v_start timestamptz;
  v_prev timestamptz;
  v_scan timestamptz;
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  v_start := v_now - make_interval(days => v_days);
  v_prev := v_now - make_interval(days => v_days * 2);
  -- MAU and retention need 30 days even when the period is shorter.
  v_scan := least(v_prev, v_now - interval '30 days');

  with act as (
    select creator_id as user_id, created_at as at from games where created_at > v_scan
    union all
    select user_id, joined_at from game_players where joined_at > v_scan
    union all
    select user_id, started_at from court_presence where started_at > v_scan
    union all
    select challenger_id, created_at from challenges where created_at > v_scan
    union all
    select user_id, responded_at from challenge_players
      where responded_at > v_scan and status in ('accepted', 'declined')
    union all
    select changed_by, created_at from court_changes where created_at > v_scan and changed_by is not null
    union all
    select updated_by, updated_at from game_results where updated_at > v_scan and updated_by is not null
    union all
    select created_by, created_at from courts where created_at > v_scan and created_by is not null
    union all
    select user_id, created_at from reports where created_at > v_scan
    union all
    select requester_id, created_at from friend_links where created_at > v_scan
    union all
    select addressee_id, responded_at from friend_links where responded_at > v_scan
    union all
    select user_id, created_at from friend_bumps where created_at > v_scan
  ),
  days as (
    select d::date as day
    from generate_series(v_today - (v_days - 1), v_today, interval '1 day') d
  ),
  daily_active as (
    select (at at time zone 'utc')::date as day, count(distinct user_id) as n
    from act where at > v_start group by 1
  ),
  daily_games as (
    select (created_at at time zone 'utc')::date as day, count(*) as n
    from games where created_at > v_start group by 1
  ),
  cohort as (
    select id from users
    where created_at <= v_now - interval '8 days' and created_at > v_now - interval '30 days'
  )
  select jsonb_build_object(
    'days', v_days,
    'generated_at', v_now,
    'active', jsonb_build_object(
      'dau', (select count(distinct user_id) from act where (at at time zone 'utc')::date = v_today),
      'wau', (select count(distinct user_id) from act where at > v_now - interval '7 days'),
      'mau', (select count(distinct user_id) from act where at > v_now - interval '30 days'),
      'period', (select count(distinct user_id) from act where at > v_start),
      'previous', (select count(distinct user_id) from act where at > v_prev and at <= v_start),
      'total_users', (select count(*) from users),
      'new_users', (select count(*) from users where created_at > v_start),
      'new_users_previous', (select count(*) from users where created_at > v_prev and created_at <= v_start),
      'app_opens', (select count(distinct user_id) from refresh_tokens where created_at > v_start),
      'app_opens_previous', (select count(distinct user_id) from refresh_tokens where created_at > v_prev and created_at <= v_start)
    ),
    'features', jsonb_build_array(
      (select jsonb_build_object('key', 'games_created',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from games where created_at > v_prev),
      (select jsonb_build_object('key', 'game_joins',
        'count', count(*) filter (where gp.joined_at > v_start),
        'previous', count(*) filter (where gp.joined_at <= v_start))
       from game_players gp join games g on g.id = gp.game_id
       where gp.joined_at > v_prev and gp.user_id <> g.creator_id),
      (select jsonb_build_object('key', 'check_ins',
        'count', count(*) filter (where started_at > v_start),
        'previous', count(*) filter (where started_at <= v_start))
       from court_presence where started_at > v_prev),
      (select jsonb_build_object('key', 'challenges_sent',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from challenges where created_at > v_prev),
      (select jsonb_build_object('key', 'challenges_accepted',
        'count', count(*) filter (where responded_at > v_start),
        'previous', count(*) filter (where responded_at <= v_start))
       from challenges
       where responded_at > v_prev and game_id is not null),
      (select jsonb_build_object('key', 'challenges_completed',
        'count', count(*) filter (where completed_at > v_start),
        'previous', count(*) filter (where completed_at <= v_start))
       from challenges where completed_at > v_prev and status = 'completed'),
      (select jsonb_build_object('key', 'challenge_players_added',
        'count', count(*) filter (where cp.created_at > v_start),
        'previous', count(*) filter (where cp.created_at <= v_start))
       from challenge_players cp join challenges c on c.id = cp.challenge_id
       where cp.created_at > v_prev
         and cp.user_id <> c.challenger_id
         and cp.user_id is distinct from c.opponent_id),
      (select jsonb_build_object('key', 'court_moves',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from court_changes where created_at > v_prev),
      (select jsonb_build_object('key', 'scoreboards',
        'count', count(*) filter (where updated_at > v_start),
        'previous', count(*) filter (where updated_at <= v_start))
       from game_results where updated_at > v_prev),
      (select jsonb_build_object('key', 'courts_proposed',
        'count', count(*) filter (where c.created_at > v_start),
        'previous', count(*) filter (where c.created_at <= v_start))
       from courts c
       where c.created_at > v_prev
         and not exists (select 1 from users u where u.id = c.created_by and u.role = 'admin')),
      (select jsonb_build_object('key', 'friend_requests',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from friend_links where created_at > v_prev),
      (select jsonb_build_object('key', 'friends_connected',
        'count', count(*) filter (where responded_at > v_start),
        'previous', count(*) filter (where responded_at <= v_start))
       from friend_links where responded_at > v_prev and status = 'accepted'),
      (select jsonb_build_object('key', 'bumps',
        'count', count(*) filter (where matched_at > v_start),
        'previous', count(*) filter (where matched_at <= v_start))
       from friend_bumps where matched_at > v_prev),
      (select jsonb_build_object('key', 'friend_invite_links',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from friend_invite_links where created_at > v_prev),
      (select jsonb_build_object('key', 'game_share_links',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from game_share_links where created_at > v_prev),
      (select jsonb_build_object('key', 'badges_unlocked',
        'count', count(*) filter (where earned_at > v_start),
        'previous', count(*) filter (where earned_at <= v_start))
       from user_badges where earned_at > v_prev),
      (select jsonb_build_object('key', 'avatars_created',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from user_avatars where created_at > v_prev),
      (select jsonb_build_object('key', 'push_devices',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from push_tokens where created_at > v_prev),
      (select jsonb_build_object('key', 'reports',
        'count', count(*) filter (where created_at > v_start),
        'previous', count(*) filter (where created_at <= v_start))
       from reports where created_at > v_prev)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', d.day,
        'active', coalesce(a.n, 0),
        'games', coalesce(g.n, 0)
      ) order by d.day)
      from days d
      left join daily_active a on a.day = d.day
      left join daily_games g on g.day = d.day
    ), '[]'::jsonb),
    'top_courts', coalesce((
      select jsonb_agg(t order by t.games desc, t.name)
      from (
        select c.id, c.name, count(*) as games
        from games g join courts c on c.id = g.court_id
        where g.created_at > v_start
        group by c.id, c.name
        order by games desc, c.name
        limit 5
      ) t
    ), '[]'::jsonb),
    'sports', coalesce((
      select jsonb_agg(t order by t.games desc, t.name)
      from (
        select s.id, s.slug, s.name, s.name_fr, s.icon, count(*) as games
        from games g join sports s on s.id = g.sport_id
        where g.created_at > v_start
        group by s.id
      ) t
    ), '[]'::jsonb),
    'retention', jsonb_build_object(
      'cohort', (select count(*) from cohort),
      'returned', (
        select count(distinct a.user_id) from act a join cohort c on c.id = a.user_id
        where a.at > v_now - interval '7 days'
      )
    )
  ) into v;
  return v;
end;
$$;
