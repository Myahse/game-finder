-- Game scoreboard: optional teams, final score, per-player stats and an MVP,
-- filled in by the players of a game. Court leaderboard is built from it.

create table if not exists public.game_teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  name text not null check (char_length(name) between 1 and 24),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  score int not null default 0 check (score between 0 and 999),
  unique (game_id, position)
);

create table if not exists public.game_team_players (
  game_id uuid not null references public.games (id) on delete cascade,
  team_id uuid not null references public.game_teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  primary key (game_id, user_id)
);
create index if not exists game_team_players_team_idx on public.game_team_players (team_id);

create table if not exists public.game_player_stats (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  primary key (game_id, user_id)
);
create index if not exists game_player_stats_user_idx on public.game_player_stats (user_id);

create table if not exists public.game_results (
  game_id uuid primary key references public.games (id) on delete cascade,
  mvp_user_id uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Stat keys per sport; the first one is the headline stat (points / goals).
create or replace function public.sport_stat_keys(p_slug text)
returns text[]
language sql
immutable
as $$
  select case p_slug
    when 'basketball' then array['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers']
    when 'football' then array['goals', 'assists', 'saves', 'tackles']
    when 'volleyball' then array['points', 'aces', 'blocks', 'digs']
    when 'tennis' then array['points', 'aces', 'winners', 'errors']
    when 'badminton' then array['points', 'smashes', 'winners', 'errors']
    else array['points']
  end;
$$;

-- Winning team position, or null (fewer than 2 teams, no score yet, or a tie at the top).
create or replace function public.game_winner_position(p_game uuid)
returns smallint
language sql
stable
as $$
  with t as (
    select position, score, rank() over (order by score desc) as rk, count(*) over () as n, max(score) over () as top
    from public.game_teams where game_id = p_game
  )
  select position from t
  where rk = 1 and n >= 2 and top > 0 and (select count(*) from t where rk = 1) = 1;
$$;

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

-- Replace a game's scoreboard. Allowed for the host, players in the game and admins.
-- p = { teams: [{ name, color, score, players: [user_id] }], stats: { user_id: { key: n } }, mvp_user_id }
create or replace function public.save_game_scoreboard(p_game uuid, p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_game games;
  v_keys text[];
  v_started boolean;
  v_team jsonb;
  v_team_id uuid;
  v_pos int := 0;
  v_player text;
  v_stat record;
  v_kv record;
  v_mvp uuid;
  v_has_values boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_game from games where id = p_game for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_game.status = 'cancelled' then
    raise exception 'game_closed' using errcode = 'P0001';
  end if;
  if v_game.creator_id is distinct from v_uid and not is_admin() and not exists (
    select 1 from game_players where game_id = p_game and user_id = v_uid and status = 'joined'
  ) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p is null or jsonb_typeof(p) <> 'object'
     or jsonb_typeof(coalesce(p -> 'teams', '[]')) <> 'array'
     or jsonb_typeof(coalesce(p -> 'stats', '{}')) <> 'object'
     or jsonb_array_length(coalesce(p -> 'teams', '[]')) > 4 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select sport_stat_keys(s.slug) into v_keys from sports s where s.id = v_game.sport_id;
  v_started := v_game.start_time <= now() + interval '15 minutes';

  delete from game_teams where game_id = p_game; -- cascades to game_team_players
  delete from game_player_stats where game_id = p_game;

  for v_team in select * from jsonb_array_elements(coalesce(p -> 'teams', '[]')) loop
    if jsonb_typeof(v_team) <> 'object'
       or coalesce(char_length(trim(v_team ->> 'name')), 0) not between 1 and 24
       or coalesce(v_team ->> 'color', '') !~ '^#[0-9a-fA-F]{6}$'
       or coalesce(v_team ->> 'score', '0') !~ '^\d{1,3}$'
       or jsonb_typeof(coalesce(v_team -> 'players', '[]')) <> 'array' then
      raise exception 'invalid_input' using errcode = 'P0001';
    end if;
    if (v_team ->> 'score')::int > 0 then
      v_has_values := true;
    end if;
    insert into game_teams (game_id, position, name, color, score)
    values (p_game, v_pos, trim(v_team ->> 'name'), v_team ->> 'color', coalesce((v_team ->> 'score')::int, 0))
    returning id into v_team_id;
    for v_player in select * from jsonb_array_elements_text(coalesce(v_team -> 'players', '[]')) loop
      if not exists (select 1 from game_players where game_id = p_game and user_id::text = v_player and status = 'joined') then
        raise exception 'not_in_game' using errcode = 'P0001';
      end if;
      begin
        insert into game_team_players (game_id, team_id, user_id) values (p_game, v_team_id, v_player::uuid);
      exception when unique_violation then
        raise exception 'invalid_input' using errcode = 'P0001';
      end;
    end loop;
    v_pos := v_pos + 1;
  end loop;

  for v_stat in select key, value from jsonb_each(coalesce(p -> 'stats', '{}')) loop
    if not exists (select 1 from game_players where game_id = p_game and user_id::text = v_stat.key and status = 'joined') then
      raise exception 'not_in_game' using errcode = 'P0001';
    end if;
    if jsonb_typeof(v_stat.value) <> 'object' then
      raise exception 'invalid_input' using errcode = 'P0001';
    end if;
    for v_kv in select key, value from jsonb_each(v_stat.value) loop
      if not (v_kv.key = any (v_keys)) or jsonb_typeof(v_kv.value) <> 'number'
         or (v_kv.value)::text !~ '^\d{1,3}$' then
        raise exception 'invalid_input' using errcode = 'P0001';
      end if;
      if (v_kv.value)::int > 0 then
        v_has_values := true;
      end if;
    end loop;
    insert into game_player_stats (game_id, user_id, stats)
    select p_game, v_stat.key::uuid, coalesce(jsonb_object_agg(key, value), '{}')
    from jsonb_each(v_stat.value) where (value)::int > 0;
  end loop;

  if nullif(p ->> 'mvp_user_id', '') is not null then
    if not exists (select 1 from game_players where game_id = p_game and user_id::text = p ->> 'mvp_user_id' and status = 'joined') then
      raise exception 'not_in_game' using errcode = 'P0001';
    end if;
    v_mvp := (p ->> 'mvp_user_id')::uuid;
    v_has_values := true;
  end if;

  if v_has_values and not v_started then
    raise exception 'game_not_started' using errcode = 'P0001';
  end if;

  insert into game_results (game_id, mvp_user_id, updated_by, updated_at)
  values (p_game, v_mvp, v_uid, now())
  on conflict (game_id) do update set mvp_user_id = excluded.mvp_user_id, updated_by = excluded.updated_by, updated_at = now();

  return game_scoreboard_json(p_game);
end;
$$;

-- Court leaderboard: players ranked by wins, MVPs and games at this court.
-- p_since = null for all time.
create or replace function public.court_leaderboard(p_court uuid, p_since timestamptz default null)
returns jsonb
language sql
stable
set search_path = public
as $$
  with played as (
    select g.id as game_id, gp.user_id, s.slug
    from games g
    join sports s on s.id = g.sport_id
    join game_players gp on gp.game_id = g.id and gp.status = 'joined'
    join users u on u.id = gp.user_id and u.suspended_at is null
    where g.court_id = p_court
      and g.status <> 'cancelled'
      and g.start_time < now()
      and (p_since is null or g.start_time >= p_since)
  ),
  per_player as (
    select
      pl.user_id,
      count(*) as games,
      count(*) filter (where tp.team_id is not null and t.position = game_winner_position(pl.game_id)) as wins,
      coalesce(sum((ps.stats ->> (sport_stat_keys(pl.slug))[1])::int), 0) as points,
      count(*) filter (where r.mvp_user_id = pl.user_id) as mvps
    from played pl
    left join game_team_players tp on tp.game_id = pl.game_id and tp.user_id = pl.user_id
    left join game_teams t on t.id = tp.team_id
    left join game_player_stats ps on ps.game_id = pl.game_id and ps.user_id = pl.user_id
    left join game_results r on r.game_id = pl.game_id
    group by pl.user_id
  ),
  ranked as (
    select pp.*, wins * 3 + mvps * 2 + games as score,
           row_number() over (order by wins * 3 + mvps * 2 + games desc, points desc, games desc, pp.user_id) as rank
    from per_player pp
  )
  select jsonb_build_object(
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', r.rank, 'user', user_public_json(u), 'games', r.games, 'wins', r.wins,
        'points', r.points, 'mvps', r.mvps, 'score', r.score
      ) order by r.rank)
      from ranked r join users u on u.id = r.user_id
      where r.rank <= 20
    ), '[]'),
    'me', (
      select jsonb_build_object(
        'rank', r.rank, 'user', user_public_json(u), 'games', r.games, 'wins', r.wins,
        'points', r.points, 'mvps', r.mvps, 'score', r.score
      )
      from ranked r join users u on u.id = r.user_id
      where r.user_id = app_uid()
    )
  );
$$;
