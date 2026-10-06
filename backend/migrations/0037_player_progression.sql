-- Player progression: XP + levels, Elo rating per sport, badges, weekly streaks
-- and a weekly "King of the Court" per court.

alter type public.notification_type add value if not exists 'achievement';

-- Weather recorded for a played game (from the forecast at game time).
create table if not exists public.game_weather (
  game_id uuid primary key references public.games (id) on delete cascade,
  code int not null,
  rain_pct int not null,
  precip_mm double precision not null,
  temp double precision not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.player_ratings (
  user_id uuid not null references public.users (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete cascade,
  rating double precision not null default 1000,
  games int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);

create table if not exists public.user_badges (
  user_id uuid not null references public.users (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.court_kings (
  court_id uuid not null references public.courts (id) on delete cascade,
  week_start date not null,
  user_id uuid not null references public.users (id) on delete cascade,
  score int not null,
  primary key (court_id, week_start)
);
create index if not exists court_kings_user_idx on public.court_kings (user_id);

-- Once-only markers for periodic work (weekly kings, streak nudges).
create table if not exists public.progress_runs (
  key text primary key,
  ran_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Elo rating per sport, replayed from every scored game of that sport so that
-- edited scoreboards stay consistent. Teams play each other pairwise; every
-- player of a team gets the team's delta. K = 40 for the first 10 games, then 24.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_sport_ratings(p_sport uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_game uuid;
  v_team record;
  v_n int;
  v_delta double precision;
begin
  perform pg_advisory_xact_lock(hashtext('ratings:' || p_sport::text));
  delete from player_ratings where sport_id = p_sport;
  create temp table if not exists _elo_team (team_id uuid, score int, strength double precision) on commit drop;

  for v_game in
    select g.id
    from games g
    where g.sport_id = p_sport and g.status <> 'cancelled'
      and exists (select 1 from game_teams t where t.game_id = g.id and t.score > 0)
      and (select count(distinct tp.team_id) from game_team_players tp where tp.game_id = g.id) >= 2
    order by g.start_time, g.id
  loop
    truncate _elo_team;
    insert into _elo_team
    select t.id, t.score, avg(coalesce(pr.rating, 1000))
    from game_teams t
    join game_team_players tp on tp.team_id = t.id
    left join player_ratings pr on pr.user_id = tp.user_id and pr.sport_id = p_sport
    where t.game_id = v_game
    group by t.id, t.score;
    select count(*) into v_n from _elo_team;

    for v_team in select * from _elo_team loop
      select sum(
               case when v_team.score > o.score then 1.0 when v_team.score = o.score then 0.5 else 0.0 end
               - 1.0 / (1.0 + power(10.0, (o.strength - v_team.strength) / 400.0))
             ) / (v_n - 1)
      into v_delta
      from _elo_team o where o.team_id <> v_team.team_id;

      insert into player_ratings (user_id, sport_id, rating, games, updated_at)
      select tp.user_id, p_sport, 1000 + 40 * v_delta, 1, now()
      from game_team_players tp where tp.team_id = v_team.team_id
      on conflict (user_id, sport_id) do update set
        rating = player_ratings.rating + (case when player_ratings.games < 10 then 40 else 24 end) * v_delta,
        games = player_ratings.games + 1,
        updated_at = now();
    end loop;
  end loop;
end;
$$;

-- Scoreboard JSON now carries each player's rating (for balanced teams).
create or replace function public.game_scoreboard_json(p_game uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'game_id', g.id,
    'stat_keys', to_jsonb(sport_stat_keys(s.slug)),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'position', t.position, 'name', t.name, 'color', t.color, 'score', t.score,
        'players', coalesce((select jsonb_agg(tp.user_id order by tp.user_id) from game_team_players tp where tp.team_id = t.id), '[]')
      ) order by t.position)
      from game_teams t where t.game_id = g.id
    ), '[]'),
    'stats', coalesce((select jsonb_object_agg(ps.user_id, ps.stats) from game_player_stats ps where ps.game_id = g.id), '{}'),
    'ratings', coalesce((
      select jsonb_object_agg(gp.user_id, round(coalesce(pr.rating, 1000)))
      from game_players gp
      left join player_ratings pr on pr.user_id = gp.user_id and pr.sport_id = g.sport_id
      where gp.game_id = g.id and gp.status = 'joined'
    ), '{}'),
    'winner_position', game_winner_position(g.id),
    'mvp_user_id', r.mvp_user_id,
    'updated_at', r.updated_at,
    'updated_by', (select user_public_json(u) from users u where u.id = r.updated_by)
  )
  from games g
  join sports s on s.id = g.sport_id
  left join game_results r on r.game_id = g.id
  where g.id = p_game;
$$;

-- ---------------------------------------------------------------------------
-- Per-court, per-player scores over a time range (win 3, MVP 2, game 1).
-- ---------------------------------------------------------------------------
create or replace function public.court_scores(p_from timestamptz, p_to timestamptz)
returns table (court_id uuid, user_id uuid, games bigint, wins bigint, points bigint, mvps bigint, score bigint)
language sql
stable
set search_path = public
as $$
  with played as (
    select g.id as game_id, g.court_id, gp.user_id, s.slug
    from games g
    join sports s on s.id = g.sport_id
    join game_players gp on gp.game_id = g.id and gp.status = 'joined'
    join users u on u.id = gp.user_id and u.suspended_at is null
    where g.status <> 'cancelled' and g.start_time >= p_from and g.start_time < least(p_to, now())
  ),
  agg as (
    select
      pl.court_id, pl.user_id,
      count(*) as games,
      count(*) filter (where tp.team_id is not null and t.position = game_winner_position(pl.game_id)) as wins,
      coalesce(sum((ps.stats ->> (sport_stat_keys(pl.slug))[1])::int), 0) as points,
      count(*) filter (where r.mvp_user_id = pl.user_id) as mvps
    from played pl
    left join game_team_players tp on tp.game_id = pl.game_id and tp.user_id = pl.user_id
    left join game_teams t on t.id = tp.team_id
    left join game_player_stats ps on ps.game_id = pl.game_id and ps.user_id = pl.user_id
    left join game_results r on r.game_id = pl.game_id
    group by pl.court_id, pl.user_id
  )
  select court_id, user_id, games, wins, points, mvps, wins * 3 + mvps * 2 + games from agg;
$$;

-- Crown last week's #1 at every court (needs a win or MVP: score >= 3).
create or replace function public.crown_court_kings(p_week date)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_n int;
begin
  with best as (
    select distinct on (cs.court_id) cs.court_id, cs.user_id, cs.score
    from court_scores(p_week::timestamp at time zone 'UTC', (p_week + 7)::timestamp at time zone 'UTC') cs
    where cs.score >= 3
    order by cs.court_id, cs.score desc, cs.points desc, cs.games desc, cs.user_id
  ),
  ins as (
    insert into court_kings (court_id, week_start, user_id, score)
    select court_id, p_week, user_id, score from best
    on conflict (court_id, week_start) do nothing
    returning court_id, user_id
  )
  insert into notifications (user_id, type, title, body, data, dedupe_key)
  select i.user_id, 'achievement', 'King of the Court 👑',
         'You were #1 at ' || c.name || ' last week. The crown is yours this week!',
         jsonb_build_object('kind', 'king', 'court_id', i.court_id),
         'king:' || i.court_id || ':' || p_week
  from ins i join courts c on c.id = i.court_id
  on conflict (dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Streaks: consecutive ISO weeks (UTC) with a played game or a check-in.
-- ---------------------------------------------------------------------------
create or replace function public.player_streak(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with acts as (
    select g.start_time as at
    from game_players gp join games g on g.id = gp.game_id
    where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < now()
    union all
    select started_at from court_presence where user_id = p_user
  ),
  weeks as (select distinct date_trunc('week', at at time zone 'UTC')::date as wk from acts),
  isl as (select wk, wk - (row_number() over (order by wk))::int * 7 as grp from weeks),
  runs as (select min(wk) as s, max(wk) as e, count(*)::int as n from isl group by grp),
  cur as (select date_trunc('week', now() at time zone 'UTC')::date as wk)
  select jsonb_build_object(
    'current', coalesce((select r.n from runs r, cur where r.e >= cur.wk - 7), 0),
    'best', coalesce((select max(n) from runs), 0),
    'active_this_week', exists (select 1 from runs r, cur where r.e = cur.wk),
    'week_ends_at', ((select wk from cur) + 7)::timestamp at time zone 'UTC'
  );
$$;

-- ---------------------------------------------------------------------------
-- Raw counters behind XP and badges.
-- ---------------------------------------------------------------------------
create or replace function public.player_stats(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with played as (
    select g.id, g.court_id, g.start_time, c.longitude
    from game_players gp
    join games g on g.id = gp.game_id
    join courts c on c.id = g.court_id
    where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < now()
  ),
  local_hours as (
    -- Approximate local time from the court's longitude (15° per hour).
    select extract(hour from (p.start_time at time zone 'UTC') + make_interval(hours => round(p.longitude / 15)::int))::int as h
    from played p
  )
  select jsonb_build_object(
    'games', (select count(*) from played),
    'wins', (select count(*) from played p
             join game_team_players tp on tp.game_id = p.id and tp.user_id = p_user
             join game_teams t on t.id = tp.team_id
             where t.position = game_winner_position(p.id)),
    'mvps', (select count(*) from played p join game_results r on r.game_id = p.id where r.mvp_user_id = p_user),
    'hosted', (select count(*) from games g where g.creator_id = p_user and g.status <> 'cancelled' and g.start_time < now()),
    'check_ins', (select count(distinct (court_id, (started_at at time zone 'UTC')::date)) from court_presence where user_id = p_user),
    'courts', (select count(distinct cid) from (
                 select court_id as cid from played
                 union select court_id from court_presence where user_id = p_user) x),
    'friends', (select count(*) from friend_links where status = 'accepted' and (requester_id = p_user or addressee_id = p_user)),
    'early', (select count(*) from local_hours where h < 8),
    'night', (select count(*) from local_hours where h >= 21),
    'rain', (select count(*) from played p join game_weather w on w.game_id = p.id
             where w.precip_mm >= 0.3 or w.code between 51 and 67 or w.code between 80 and 99),
    'kings', (select count(*) from court_kings where user_id = p_user),
    'best_streak', (player_streak(p_user) ->> 'best')::int
  );
$$;

-- Badge catalogue: id, counter in player_stats, goal, display order, English name.
create or replace function public.badge_defs()
returns table (id text, metric text, goal int, ord int, name text)
language sql
immutable
as $$
  values
    ('first_game', 'games', 1, 1, 'First game'),
    ('games_10', 'games', 10, 2, '10 games'),
    ('games_50', 'games', 50, 3, '50 games'),
    ('games_100', 'games', 100, 4, '100 games'),
    ('first_win', 'wins', 1, 5, 'First win'),
    ('wins_10', 'wins', 10, 6, '10 wins'),
    ('first_mvp', 'mvps', 1, 7, 'First MVP'),
    ('mvp_5', 'mvps', 5, 8, '5× MVP'),
    ('host_5', 'hosted', 5, 9, 'Host'),
    ('courts_5', 'courts', 5, 10, 'Explorer'),
    ('early_bird', 'early', 1, 11, 'Early bird'),
    ('night_owl', 'night', 1, 12, 'Night owl'),
    ('rain_player', 'rain', 1, 13, 'Played in the rain'),
    ('streak_4', 'best_streak', 4, 14, '4-week streak'),
    ('king', 'kings', 1, 15, 'King of the Court'),
    ('social_10', 'friends', 10, 16, 'Connector')
$$;

-- Records newly earned badges (with a notification) and returns their ids.
create or replace function public.sync_badges(p_user uuid)
returns text[]
language plpgsql
set search_path = public
as $$
declare
  v_stats jsonb := player_stats(p_user);
  v_new text[];
begin
  with earned as (
    select d.id, d.name from badge_defs() d
    where coalesce((v_stats ->> d.metric)::int, 0) >= d.goal
  ),
  ins as (
    insert into user_badges (user_id, badge_id)
    select p_user, e.id from earned e
    on conflict do nothing
    returning badge_id
  ),
  notify as (
    insert into notifications (user_id, type, title, body, data, dedupe_key, push)
    select p_user, 'achievement', 'New badge: ' || e.name, 'You unlocked the "' || e.name || '" badge. Share it with your crew!',
           jsonb_build_object('kind', 'badge', 'badge_id', e.id), 'badge:' || p_user || ':' || e.id, false
    from ins join earned e on e.id = ins.badge_id
    on conflict (dedupe_key) do nothing
  )
  select coalesce(array_agg(badge_id), '{}') into v_new from ins;
  return v_new;
end;
$$;

-- XP: game 10 · win 15 · MVP 25 · hosted 5 · check-in day 2 · badge 20.
-- Level L needs 50·L·(L−1) XP.
create or replace function public.player_progress(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with s as (select player_stats(p_user) as j),
  b as (select count(*)::int as n from user_badges where user_id = p_user),
  x as (
    select (10 * (j ->> 'games')::int + 15 * (j ->> 'wins')::int + 25 * (j ->> 'mvps')::int
            + 5 * (j ->> 'hosted')::int + 2 * (j ->> 'check_ins')::int + 20 * b.n) as xp
    from s, b
  ),
  lv as (select xp, floor((1 + sqrt(1 + 0.08 * xp)) / 2)::int as level from x)
  select jsonb_build_object(
    'xp', lv.xp,
    'level', lv.level,
    'level_xp', 50 * lv.level * (lv.level - 1),
    'next_level_xp', 50 * (lv.level + 1) * lv.level,
    'stats', s.j,
    'streak', player_streak(p_user),
    'ratings', coalesce((
      select jsonb_agg(jsonb_build_object('sport', sport_json(sp), 'rating', round(pr.rating), 'games', pr.games) order by pr.games desc)
      from player_ratings pr join sports sp on sp.id = pr.sport_id
      where pr.user_id = p_user
    ), '[]'),
    'badges', (
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'goal', d.goal, 'have', least(coalesce((s.j ->> d.metric)::int, 0), d.goal),
        'earned_at', ub.earned_at
      ) order by d.ord)
      from badge_defs() d left join user_badges ub on ub.user_id = p_user and ub.badge_id = d.id
    ),
    'crowns', coalesce((
      select jsonb_agg(jsonb_build_object('court_id', k.court_id, 'court_name', c.name))
      from court_kings k join courts c on c.id = k.court_id
      where k.user_id = p_user and k.week_start = date_trunc('week', now() at time zone 'UTC')::date - 7
    ), '[]')
  )
  from lv, s;
$$;

-- This week's kings (crowned from last week's results).
create or replace function public.current_kings()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', k.user_id, 'court_id', k.court_id, 'court_name', c.name)), '[]')
  from court_kings k join courts c on c.id = k.court_id
  where k.week_start = date_trunc('week', now() at time zone 'UTC')::date - 7;
$$;

-- ---------------------------------------------------------------------------
-- Periodic work, called by the job loop after tick().
-- ---------------------------------------------------------------------------
create or replace function public.progress_tick()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_week date := date_trunc('week', now() at time zone 'UTC')::date;
  v_kings int := 0;
  v_nudges int := 0;
begin
  -- 1. Monday: crown last week's kings (once).
  insert into progress_runs (key) values ('kings:' || (v_week - 7)) on conflict do nothing;
  if found then
    v_kings := crown_court_kings(v_week - 7);
  end if;

  -- 2. From Friday 10:00 UTC: nudge players whose streak (≥ 2 weeks) ends this Sunday.
  if extract(isodow from now() at time zone 'UTC') >= 5 and extract(hour from now() at time zone 'UTC') >= 10 then
    insert into progress_runs (key) values ('streak:' || v_week) on conflict do nothing;
    if found then
      with candidates as (
        select distinct x.user_id from (
          select gp.user_id from game_players gp join games g on g.id = gp.game_id
          where gp.status = 'joined' and g.status <> 'cancelled'
            and g.start_time >= (v_week - 7)::timestamp at time zone 'UTC' and g.start_time < v_week::timestamp at time zone 'UTC'
          union
          select user_id from court_presence
          where started_at >= (v_week - 7)::timestamp at time zone 'UTC' and started_at < v_week::timestamp at time zone 'UTC'
        ) x
        join users u on u.id = x.user_id and u.suspended_at is null
      ),
      at_risk as (
        select c.user_id, player_streak(c.user_id) as st from candidates c
      )
      insert into notifications (user_id, type, title, body, data, dedupe_key)
      select a.user_id, 'achievement', '🔥 ' || (a.st ->> 'current') || '-week streak',
             'Your streak ends Sunday. Play or check in at a court this weekend to keep it alive.',
             jsonb_build_object('kind', 'streak', 'weeks', (a.st ->> 'current')::int),
             'streak:' || a.user_id || ':' || v_week
      from at_risk a
      where (a.st ->> 'current')::int >= 2 and not (a.st ->> 'active_this_week')::boolean
      on conflict (dedupe_key) do nothing;
      get diagnostics v_nudges = row_count;
    end if;
  end if;

  return jsonb_build_object('kings', v_kings, 'streak_nudges', v_nudges);
end;
$$;
