-- Mode Jeu for every sport (basketball, football, volleyball, tennis,
-- badminton), and avatar XP from Mode Jeu matches: simulated and online
-- matches give XP, at most 200 per week, plus Mode Jeu badges. Real games keep
-- giving XP through player_progress as before.

drop function if exists public.game_arena(uuid);
drop function if exists public.game_players(uuid[]);
drop function if exists public.game_me();
drop function if exists public.game_player_json(uuid);
drop function if exists public.game_attributes(uuid, timestamptz);

create or replace function public.game_sports()
returns text[]
language sql
immutable
as $$ select array['basketball', 'football', 'volleyball', 'tennis', 'badminton'] $$;

-- ---------------------------------------------------------------------------
-- Six attributes (40–99) from a player's real games of one sport up to p_at.
-- The keys are the same for every sport; each sport reads them its own way:
--   basketball  tir shooting   pen driving   col teamwork  def defense
--   football    tir finishing  pen dribbling col passing   def defending
--   volleyball  tir attack     pen serve     col setting   def block & dig
--   tennis      tir power      pen serve     col placement def return
--   badminton   tir smash      pen serve     col touch     def defense
-- end (games and check-ins over 30 days) and men (streak, MVPs, challenges)
-- are shared. Everything starts from the player card base for that sport
-- (Elo, games, win rate), as in 0051.
-- ---------------------------------------------------------------------------
create or replace function public.game_attributes(p_user uuid, p_sport text default 'basketball', p_at timestamptz default now())
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_slug text := case when p_sport = any(game_sports()) then p_sport else 'basketball' end;
  v_sport uuid;
  k text[];
  v_elo double precision := 1000;
  v_games int := 0;
  v_wins int := 0;
  v_base numeric;
  a1 numeric := 0; a2 numeric := 0; a3 numeric := 0; a4 numeric := 0; a5 numeric := 0;
  v_best int := 0;
  v_stat_games int := 0;
  v_big int := 0;
  v_g30 int := 0;
  v_c30 int := 0;
  v_mvps int := 0;
  v_chal int := 0;
  v_streak int := 0;
  t numeric; p numeric; c numeric; d numeric;
  a jsonb;
begin
  select id into v_sport from sports where slug = v_slug;
  k := sport_stat_keys(v_slug);

  select h.rating into v_elo from player_rating_history h
  where h.user_id = p_user and h.sport_id = v_sport and h.played_at < p_at
  order by h.played_at desc limit 1;
  v_elo := coalesce(v_elo, 1000);

  select count(*), count(*) filter (where game_winner_position(g.id) = tm.position)
  into v_games, v_wins
  from game_team_players tp
  join games g on g.id = tp.game_id
  join game_teams tm on tm.id = tp.team_id
  where tp.user_id = p_user and g.sport_id = v_sport and g.status <> 'cancelled' and g.start_time < p_at
    and exists (select 1 from game_teams t2 where t2.game_id = g.id and t2.score > 0)
    and (select count(distinct tp2.team_id) from game_team_players tp2 where tp2.game_id = g.id) >= 2;

  select count(*),
         coalesce(avg(coalesce((ps.stats ->> k[1])::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> k[2])::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> k[3])::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> k[4])::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> coalesce(k[5], k[4]))::numeric, 0)), 0),
         coalesce(max(coalesce((ps.stats ->> k[1])::int, 0)), 0)
  into v_stat_games, a1, a2, a3, a4, a5, v_best
  from game_player_stats ps join games g on g.id = ps.game_id
  where ps.user_id = p_user and g.sport_id = v_sport and g.status <> 'cancelled' and g.start_time < p_at;

  select count(*) into v_big
  from game_players gp join games g on g.id = gp.game_id
  where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < p_at and g.sport_id = v_sport
    and (select count(*) from game_players o where o.game_id = g.id and o.status = 'joined') >= 6;

  select count(*) into v_g30
  from game_players gp join games g on g.id = gp.game_id
  where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled'
    and g.start_time < p_at and g.start_time >= p_at - interval '30 days';

  select count(distinct (court_id, (started_at at time zone 'UTC')::date)) into v_c30
  from court_presence where user_id = p_user and started_at < p_at and started_at >= p_at - interval '30 days';

  select count(*) into v_mvps from game_results r join games g on g.id = r.game_id
  where r.mvp_user_id = p_user and g.status <> 'cancelled' and g.start_time < p_at and g.sport_id = v_sport;

  select count(*) into v_chal
  from challenges ch join challenge_players cp on cp.challenge_id = ch.id and cp.user_id = p_user and cp.status = 'accepted'
  where ch.status = 'completed' and ch.winner_id is not null and ch.created_at < p_at
    and (ch.winner_id = ch.challenger_id) = (cp.side = 'challenger');

  with acts as (
    select g.start_time as at from game_players gp join games g on g.id = gp.game_id
    where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < p_at
    union all
    select started_at from court_presence where user_id = p_user and started_at < p_at
  ),
  weeks as (select distinct date_trunc('week', at at time zone 'UTC')::date as wk from acts),
  isl as (select wk, wk - (row_number() over (order by wk))::int * 7 as grp from weeks),
  runs as (select max(wk) as e, count(*)::int as n from isl group by grp)
  select coalesce(max(n), 0) into v_streak from runs
  where e >= date_trunc('week', p_at at time zone 'UTC')::date - 7;

  v_base := 40 + (round(v_elo) - 900) * 0.075 + least(v_games, 40) / 10.0
    + greatest(0, case when v_games > 0 then v_wins::numeric / v_games else 0 end - 0.5) * 4;

  case v_slug
    when 'basketball' then  -- points, rebounds, assists, steals, blocks
      t := (a1 - 6) * 1.2 + least(v_best, 30) * 0.15 - 2;
      p := (a1 - 6) * 0.9 + (a2 - 3) * 1.2 + least(v_wins, 20) * 0.2;
      c := (a3 - 2) * 3 + least(v_big, 20) * 0.25;
      d := (a4 + a5 - 1) * 4 + a2 * 0.5 - 2;
    when 'football' then    -- goals, assists, saves, tackles
      t := (a1 - 0.5) * 8 + least(v_best, 5) * 1.0 - 1;
      p := (a1 + a2) * 3 + least(v_wins, 20) * 0.25 - 1;
      c := (a2 - 0.3) * 8 + least(v_big, 20) * 0.25;
      d := (a4 - 1) * 3 + a3 * 2;
    when 'volleyball' then  -- points, aces, blocks, digs
      t := (a1 - 5) * 1.2 + least(v_best, 25) * 0.12;
      p := (a2 - 0.5) * 6;
      c := least(v_big, 20) * 0.3 + least(v_wins, 20) * 0.2;
      d := (a3 + a4 - 2) * 2;
    when 'tennis' then      -- points, aces, winners, errors
      t := (a3 - 3) * 1.5 + (a1 - 10) * 0.3;
      p := (a2 - 1) * 4;
      c := (a3 - 3) * 1.0 + least(v_wins, 20) * 0.25;
      d := (3 - a4) * 2 + least(v_wins, 20) * 0.2;
    else                    -- badminton: points, smashes, winners, errors
      t := (a2 - 2) * 2.5 + (a1 - 10) * 0.3;
      p := least(v_wins, 20) * 0.25 + (a1 - 10) * 0.2;
      c := (a3 - 3) * 1.2;
      d := (3 - a4) * 2 + least(v_wins, 20) * 0.2;
  end case;

  a := jsonb_build_object(
    'tir', round(v_base + t), 'pen', round(v_base + p), 'col', round(v_base + c), 'def', round(v_base + d),
    'end', round(v_base - 5 + least(v_g30, 12) * 1.2 + least(v_c30, 15) * 0.4),
    'men', round(v_base + least(v_streak, 8) * 1.2 + least(v_mvps, 10) * 0.8 + least(v_chal, 10) * 0.5 - 1)
  );
  select jsonb_object_agg(key, least(99, greatest(40, value::int))) into a from jsonb_each_text(a);

  return jsonb_build_object(
    'sport', v_slug,
    'attributes', a,
    'ovr', (select round(avg(value::int))::int from jsonb_each_text(a)),
    'sources', jsonb_build_object(
      'keys', to_jsonb(k[1:4]),
      'elo', round(v_elo)::int, 'games', v_games, 'wins', v_wins, 'stat_games', v_stat_games,
      's1', round(a1, 1), 's2', round(a2, 1), 's3', round(a3, 1), 's4', round(a4, 1), 's5', round(a5, 1),
      'best', v_best, 'big_games', v_big, 'games_30d', v_g30, 'check_ins_30d', v_c30,
      'mvps', v_mvps, 'challenges_won', v_chal, 'streak_weeks', v_streak
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Mode Jeu XP: simulated and online matches give the avatar XP, at most 200
-- per week (Monday, UTC). Badges for Mode Jeu feats.
-- ---------------------------------------------------------------------------
create table if not exists public.game_xp (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  sport text not null,
  mode text not null check (mode in ('solo', 'online')),
  won boolean not null,
  mvp boolean not null default false,
  raw_xp int not null,
  xp int not null,
  match_ref text,
  at timestamptz not null default now()
);
create index if not exists game_xp_user_at_idx on public.game_xp (user_id, at desc);
-- One award per player per online match.
create unique index if not exists game_xp_match_idx on public.game_xp (user_id, match_ref) where match_ref is not null;

create table if not exists public.game_badges (
  user_id uuid not null references public.users (id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);

create or replace function public.game_week_cap() returns int language sql immutable as $$ select 200 $$;

create or replace function public.game_xp_json(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with w as (select date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' as start),
  s as (
    select coalesce(sum(xp), 0)::int as total,
           coalesce(sum(xp) filter (where at >= (select start from w)), 0)::int as week,
           count(*) filter (where won)::int as wins,
           count(*)::int as matches
    from game_xp where user_id = p_user
  ),
  lv as (select (player_progress(p_user) ->> 'xp')::int + s.total as xp from s)
  select jsonb_build_object(
    'total', s.total, 'week', s.week, 'cap', game_week_cap(), 'wins', s.wins, 'matches', s.matches,
    'week_ends_at', (select start from w) + interval '7 days',
    -- The avatar's level counts real XP and Mode Jeu XP.
    'avatar_xp', lv.xp,
    'avatar_level', floor((1 + sqrt(1 + 0.08 * lv.xp)) / 2)::int,
    'badges', coalesce((select jsonb_agg(jsonb_build_object('id', b.badge, 'earned_at', b.earned_at) order by b.earned_at)
                        from game_badges b where b.user_id = p_user), '[]')
  )
  from s, lv;
$$;

-- Records one Mode Jeu result for a player and returns the XP given (within
-- the weekly cap) and new badges. Solo results arrive from the phone, so a
-- solo match less than 15 s after the previous one gives nothing (the weekly
-- limit is the real cap).
-- p_stats: {"pts": n, "tpm": n, "goals": n, "aces": n, "smashes": n} as the sport has them.
create or replace function public.game_award(p_user uuid, p_sport text, p_mode text, p_won boolean, p_mvp boolean, p_stats jsonb, p_match text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_raw int;
  v_week int;
  v_xp int;
  v_new text[] := '{}';
  v_sport text := case when p_sport = any(game_sports()) then p_sport else 'basketball' end;
  b text;
begin
  perform pg_advisory_xact_lock(hashtext('game_xp:' || p_user::text));
  v_raw := case when p_mode = 'online' then case when p_won then 40 else 15 end else case when p_won then 25 else 10 end end
           + case when p_mvp then 10 else 0 end;
  if p_mode = 'solo' and exists (select 1 from game_xp where user_id = p_user and mode = 'solo' and at > now() - interval '15 seconds') then
    v_raw := 0;
  end if;
  select coalesce(sum(xp), 0) into v_week from game_xp
  where user_id = p_user and at >= date_trunc('week', now() at time zone 'UTC') at time zone 'UTC';
  v_xp := least(v_raw, greatest(0, game_week_cap() - v_week));
  insert into game_xp (user_id, sport, mode, won, mvp, raw_xp, xp, match_ref)
  values (p_user, v_sport, p_mode, p_won, p_mvp, v_raw, v_xp, p_match)
  on conflict (user_id, match_ref) where match_ref is not null do nothing;
  if not found then
    return jsonb_build_object('xp', 0, 'raw', 0, 'duplicate', true) || game_xp_json(p_user);
  end if;

  for b in
    select x.badge from (values
      ('first_win', exists (select 1 from game_xp where user_id = p_user and won)),
      ('wins_10', (select count(*) from game_xp where user_id = p_user and won) >= 10),
      ('wins_50', (select count(*) from game_xp where user_id = p_user and won) >= 50),
      ('mvp_5', (select count(*) from game_xp where user_id = p_user and mvp) >= 5),
      ('online_win', exists (select 1 from game_xp where user_id = p_user and won and mode = 'online')),
      ('all_sports', (select count(distinct sport) from game_xp where user_id = p_user and won) >= 5),
      ('sniper', v_sport = 'basketball' and coalesce((p_stats ->> 'tpm')::int, 0) >= 4),
      ('hat_trick', v_sport = 'football' and coalesce((p_stats ->> 'goals')::int, 0) >= 3),
      ('ace_volley', v_sport = 'volleyball' and coalesce((p_stats ->> 'aces')::int, 0) >= 3),
      ('ace_tennis', v_sport = 'tennis' and coalesce((p_stats ->> 'aces')::int, 0) >= 3),
      ('smash_5', v_sport = 'badminton' and coalesce((p_stats ->> 'smashes')::int, 0) >= 5),
      ('week_max', v_week + v_xp >= game_week_cap())
    ) as x (badge, ok)
    where x.ok and not exists (select 1 from game_badges gb where gb.user_id = p_user and gb.badge = x.badge)
  loop
    insert into game_badges (user_id, badge) values (p_user, b) on conflict do nothing;
    v_new := v_new || b;
  end loop;

  return jsonb_build_object('xp', v_xp, 'raw', v_raw, 'capped', v_xp < v_raw, 'new_badges', to_jsonb(v_new)) || game_xp_json(p_user);
end;
$$;

-- One player as Mode Jeu shows them for a sport.
create or replace function public.game_player_json(p_user uuid, p_sport text default 'basketball')
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'user', user_public_json(u),
    'number', 1 + abs(hashtext(u.id::text)) % 35,
    'level', (player_progress(u.id) ->> 'level')::int
  ) || game_attributes(u.id, p_sport)
  from users u where u.id = p_user and u.suspended_at is null;
$$;

create or replace function public.game_players(p_ids uuid[], p_sport text default 'basketball')
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(game_player_json(u.id, p_sport)), '[]')
  from users u where u.id = any(p_ids[1:12]) and u.suspended_at is null;
$$;

-- The signed-in player's avatar for a sport: attributes now and 30 days ago,
-- real XP, Mode Jeu XP and badges, and the real games of that sport behind them.
create or replace function public.game_me(p_sport text default 'basketball')
returns jsonb
language sql
stable
set search_path = public
as $$
  select game_player_json(app_uid(), p_sport) || jsonb_build_object(
    'before', game_attributes(app_uid(), p_sport, now() - interval '30 days') -> 'attributes',
    'progress', player_progress(app_uid()) - 'badges',
    'game', game_xp_json(app_uid()),
    'played_sports', coalesce((
      select jsonb_agg(distinct s.slug) from game_players gp join games g on g.id = gp.game_id join sports s on s.id = g.sport_id
      where gp.user_id = app_uid() and gp.status = 'joined' and g.status <> 'cancelled' and s.slug = any(game_sports())), '[]'),
    'history', coalesce((
      select jsonb_agg(h order by h ->> 'at' desc) from (
        select jsonb_build_object(
          'kind', 'game', 'id', g.id, 'at', g.start_time, 'court', c.name,
          'players', (select count(*) from game_players o where o.game_id = g.id and o.status = 'joined'),
          'won', case when game_winner_position(g.id) is null then null else game_winner_position(g.id) = t.position end,
          'mvp', r.mvp_user_id = app_uid(),
          'stats', ps.stats,
          'stat_keys', to_jsonb(sport_stat_keys(s.slug)),
          'xp', 10 + case when game_winner_position(g.id) = t.position then 15 else 0 end
                   + case when r.mvp_user_id = app_uid() then 25 else 0 end
        ) as h
        from game_players gp
        join games g on g.id = gp.game_id
        join sports s on s.id = g.sport_id
        join courts c on c.id = g.court_id
        left join game_team_players tp on tp.game_id = g.id and tp.user_id = gp.user_id
        left join game_teams t on t.id = tp.team_id
        left join game_results r on r.game_id = g.id
        left join game_player_stats ps on ps.game_id = g.id and ps.user_id = gp.user_id
        where gp.user_id = app_uid() and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < now() and s.slug = p_sport
        order by g.start_time desc limit 8
      ) x
    ), '[]')
  );
$$;

-- An arena for one sport: the court's best players of that sport over the
-- last 90 days (last week's king first), your friends, and you.
create or replace function public.game_arena(p_court uuid, p_sport text default 'basketball')
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_c courts;
  v_king uuid;
  v_slug text := case when p_sport = any(game_sports()) then p_sport else 'basketball' end;
  v_team uuid[];
begin
  select * into v_c from courts where id = p_court;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select k.user_id into v_king from court_kings k
  where k.court_id = p_court and k.week_start = date_trunc('week', now() at time zone 'UTC')::date - 7;

  with played as (
    select gp.user_id,
           count(*) as games,
           count(*) filter (where t.position = game_winner_position(g.id)) as wins,
           count(*) filter (where r.mvp_user_id = gp.user_id) as mvps
    from games g
    join sports s on s.id = g.sport_id and s.slug = v_slug
    join game_players gp on gp.game_id = g.id and gp.status = 'joined'
    join users u on u.id = gp.user_id and u.suspended_at is null
    left join game_team_players tp on tp.game_id = g.id and tp.user_id = gp.user_id
    left join game_teams t on t.id = tp.team_id
    left join game_results r on r.game_id = g.id
    where g.court_id = p_court and g.status <> 'cancelled' and g.start_time < now() and g.start_time >= now() - interval '90 days'
      and gp.user_id <> coalesce(app_uid(), '00000000-0000-0000-0000-000000000000')
    group by gp.user_id
  )
  select array_agg(user_id order by (user_id = v_king) desc, wins * 3 + mvps * 2 + games desc, user_id) into v_team
  from (select * from played order by (user_id = v_king) desc, wins * 3 + mvps * 2 + games desc, user_id limit 3) x;

  return jsonb_build_object(
    'sport', v_slug,
    'court', jsonb_build_object('id', v_c.id, 'name', v_c.name, 'latitude', v_c.latitude, 'longitude', v_c.longitude,
      'players_here', (select count(*) from court_presence p where p.court_id = p_court and p.status = 'active'),
      'sports', coalesce((select jsonb_agg(s.slug order by array_position(game_sports(), s.slug)) from court_sports cs join sports s on s.id = cs.sport_id
                          where cs.court_id = p_court and s.slug = any(game_sports())), '[]')),
    'king_id', case when v_king = any(coalesce(v_team, '{}')) then v_king end,
    'rivals', coalesce((select jsonb_agg(game_player_json(x, v_slug) order by i) from unnest(v_team) with ordinality as u(x, i)), '[]'),
    'friends', coalesce((
      select jsonb_agg(game_player_json(f.id, v_slug) order by f.together desc, f.id) from (
        select u.id, (
          select count(*) from game_players a join game_players b on b.game_id = a.game_id and b.user_id = u.id and b.status = 'joined'
          where a.user_id = app_uid() and a.status = 'joined') as together
        from friend_links fl
        join users u on u.id = case when fl.requester_id = app_uid() then fl.addressee_id else fl.requester_id end
        where fl.status = 'accepted' and (fl.requester_id = app_uid() or fl.addressee_id = app_uid()) and u.suspended_at is null
        order by together desc, u.id limit 12
      ) f
    ), '[]'),
    'me', game_player_json(app_uid(), v_slug)
  );
end;
$$;
