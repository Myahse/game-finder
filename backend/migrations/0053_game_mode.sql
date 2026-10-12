-- Mode Jeu: a game space where each player's avatar plays 3 against 3 basketball
-- with attributes computed from their real games. Nothing here gives XP: only
-- real games do (player_progress). Online matches themselves live in the API's
-- memory; the database only lists who plays and tells friends about a match.

alter type public.notification_type add value if not exists 'jeu';

-- ---------------------------------------------------------------------------
-- Six attributes (40–99) from real basketball activity up to p_at, so the
-- avatar screen can compare today with 30 days ago.
--   tir   shooting     points per game, best game
--   pen   driving      points and rebounds per game, wins
--   col   teamwork     assists per game, games with 6+ players
--   def   defense      steals + blocks per game, rebounds
--   end   endurance    games and check-ins over the last 30 days
--   men   mental       weekly streak, MVPs, challenges won
-- Every attribute starts from the card rating (Elo, games and win rate).
-- ---------------------------------------------------------------------------
create or replace function public.game_attributes(p_user uuid, p_at timestamptz default now())
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_sport uuid;
  v_elo double precision := 1000;
  v_games int := 0;
  v_wins int := 0;
  v_base numeric;
  v_ppg numeric := 0;
  v_rpg numeric := 0;
  v_apg numeric := 0;
  v_spg numeric := 0;
  v_bpg numeric := 0;
  v_best int := 0;
  v_stat_games int := 0;
  v_big int := 0;
  v_g30 int := 0;
  v_c30 int := 0;
  v_mvps int := 0;
  v_chal int := 0;
  v_streak int := 0;
  a jsonb;
begin
  select id into v_sport from sports where slug = 'basketball';

  select h.rating into v_elo from player_rating_history h
  where h.user_id = p_user and h.sport_id = v_sport and h.played_at < p_at
  order by h.played_at desc limit 1;
  v_elo := coalesce(v_elo, 1000);

  -- Scored basketball games, by the rules of the Elo replay.
  select count(*), count(*) filter (where game_winner_position(g.id) = t.position)
  into v_games, v_wins
  from game_team_players tp
  join games g on g.id = tp.game_id
  join game_teams t on t.id = tp.team_id
  where tp.user_id = p_user and g.sport_id = v_sport and g.status <> 'cancelled' and g.start_time < p_at
    and exists (select 1 from game_teams t2 where t2.game_id = g.id and t2.score > 0)
    and (select count(distinct tp2.team_id) from game_team_players tp2 where tp2.game_id = g.id) >= 2;

  select count(*),
         coalesce(avg(coalesce((ps.stats ->> 'points')::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> 'rebounds')::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> 'assists')::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> 'steals')::numeric, 0)), 0),
         coalesce(avg(coalesce((ps.stats ->> 'blocks')::numeric, 0)), 0),
         coalesce(max(coalesce((ps.stats ->> 'points')::int, 0)), 0)
  into v_stat_games, v_ppg, v_rpg, v_apg, v_spg, v_bpg, v_best
  from game_player_stats ps join games g on g.id = ps.game_id
  where ps.user_id = p_user and g.sport_id = v_sport and g.status <> 'cancelled' and g.start_time < p_at;

  select count(*) into v_big
  from game_players gp join games g on g.id = gp.game_id
  where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < p_at
    and (select count(*) from game_players o where o.game_id = g.id and o.status = 'joined') >= 6;

  select count(*) into v_g30
  from game_players gp join games g on g.id = gp.game_id
  where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled'
    and g.start_time < p_at and g.start_time >= p_at - interval '30 days';

  select count(distinct (court_id, (started_at at time zone 'UTC')::date)) into v_c30
  from court_presence where user_id = p_user and started_at < p_at and started_at >= p_at - interval '30 days';

  select count(*) into v_mvps from game_results r join games g on g.id = r.game_id
  where r.mvp_user_id = p_user and g.status <> 'cancelled' and g.start_time < p_at;

  select count(*) into v_chal
  from challenges c join challenge_players cp on cp.challenge_id = c.id and cp.user_id = p_user and cp.status = 'accepted'
  where c.status = 'completed' and c.winner_id is not null and c.created_at < p_at
    and (c.winner_id = c.challenger_id) = (cp.side = 'challenger');

  -- Weeks in a row with a game or a check-in, ending at p_at.
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

  -- Same base as the player card (0051), without the streak bonus.
  v_base := 40 + (round(v_elo) - 900) * 0.075 + least(v_games, 40) / 10.0
    + greatest(0, case when v_games > 0 then v_wins::numeric / v_games else 0 end - 0.5) * 4;

  a := jsonb_build_object(
    'tir', round(v_base + (v_ppg - 6) * 1.2 + least(v_best, 30) * 0.15 - 2),
    'pen', round(v_base + (v_ppg - 6) * 0.9 + (v_rpg - 3) * 1.2 + least(v_wins, 20) * 0.2),
    'col', round(v_base + (v_apg - 2) * 3 + least(v_big, 20) * 0.25),
    'def', round(v_base + (v_spg + v_bpg - 1) * 4 + v_rpg * 0.5 - 2),
    'end', round(v_base - 5 + least(v_g30, 12) * 1.2 + least(v_c30, 15) * 0.4),
    'men', round(v_base + least(v_streak, 8) * 1.2 + least(v_mvps, 10) * 0.8 + least(v_chal, 10) * 0.5 - 1)
  );
  select jsonb_object_agg(k, least(99, greatest(40, (a ->> k)::int))) into a from jsonb_object_keys(a) k;

  return jsonb_build_object(
    'attributes', a,
    'ovr', (select round(avg(value::int))::int from jsonb_each_text(a)),
    'sources', jsonb_build_object(
      'elo', round(v_elo)::int, 'games', v_games, 'wins', v_wins, 'stat_games', v_stat_games,
      'ppg', round(v_ppg, 1), 'rpg', round(v_rpg, 1), 'apg', round(v_apg, 1),
      'spg', round(v_spg, 1), 'bpg', round(v_bpg, 1), 'best_points', v_best,
      'big_games', v_big, 'games_30d', v_g30, 'check_ins_30d', v_c30,
      'mvps', v_mvps, 'challenges_won', v_chal, 'streak_weeks', v_streak
    )
  );
end;
$$;

-- One player as Mode Jeu shows them: public profile, attributes, level, jersey.
create or replace function public.game_player_json(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'user', user_public_json(u),
    'number', 1 + abs(hashtext(u.id::text)) % 35,
    'level', (player_progress(u.id) ->> 'level')::int
  ) || game_attributes(u.id)
  from users u where u.id = p_user and u.suspended_at is null;
$$;

-- The signed-in player's avatar: attributes now and 30 days ago, XP, and the
-- real games and challenges that moved them.
create or replace function public.game_me()
returns jsonb
language sql
stable
set search_path = public
as $$
  select game_player_json(app_uid()) || jsonb_build_object(
    'before', game_attributes(app_uid(), now() - interval '30 days') -> 'attributes',
    'progress', player_progress(app_uid()) - 'badges',
    'history', coalesce((
      select jsonb_agg(h order by h ->> 'at' desc) from (
        select jsonb_build_object(
          'kind', 'game', 'id', g.id, 'at', g.start_time, 'court', c.name,
          'players', (select count(*) from game_players o where o.game_id = g.id and o.status = 'joined'),
          'won', case when game_winner_position(g.id) is null then null else game_winner_position(g.id) = t.position end,
          'mvp', r.mvp_user_id = app_uid(),
          'stats', ps.stats,
          'xp', 10 + case when game_winner_position(g.id) = t.position then 15 else 0 end
                   + case when r.mvp_user_id = app_uid() then 25 else 0 end
        ) as h
        from game_players gp
        join games g on g.id = gp.game_id
        join courts c on c.id = g.court_id
        left join game_team_players tp on tp.game_id = g.id and tp.user_id = gp.user_id
        left join game_teams t on t.id = tp.team_id
        left join game_results r on r.game_id = g.id
        left join game_player_stats ps on ps.game_id = g.id and ps.user_id = gp.user_id
        where gp.user_id = app_uid() and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < now()
        order by g.start_time desc limit 8
      ) x
    ), '[]')
  );
$$;

-- Several players at once (ids the client already shows), suspended ones left out.
create or replace function public.game_players(p_ids uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(game_player_json(u.id)), '[]')
  from users u where u.id = any(p_ids[1:12]) and u.suspended_at is null;
$$;

-- ---------------------------------------------------------------------------
-- An arena: a real court with its king and the team to beat (last week's king
-- plus the court's best players of the last 90 days), and the signed-in
-- player's friends to pick teammates from.
-- ---------------------------------------------------------------------------
create or replace function public.game_arena(p_court uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_c courts;
  v_king uuid;
  v_team uuid[];
begin
  select * into v_c from courts where id = p_court;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select k.user_id into v_king from court_kings k
  where k.court_id = p_court and k.week_start = date_trunc('week', now() at time zone 'UTC')::date - 7;

  select array_agg(user_id order by rk) into v_team from (
    select user_id, case when user_id = v_king then 0 else 1 end as rk from (
      select cs.user_id, cs.score, cs.points from court_scores(now() - interval '90 days', now()) cs
      join users u on u.id = cs.user_id and u.suspended_at is null
      where cs.court_id = p_court and cs.user_id <> coalesce(app_uid(), '00000000-0000-0000-0000-000000000000')
      order by (cs.user_id = v_king) desc, cs.score desc, cs.points desc, cs.user_id
      limit 3
    ) top
  ) t;

  return jsonb_build_object(
    'court', jsonb_build_object('id', v_c.id, 'name', v_c.name, 'latitude', v_c.latitude, 'longitude', v_c.longitude,
      'players_here', (select count(*) from court_presence p where p.court_id = p_court and p.status = 'active')),
    'king_id', v_king,
    'rivals', coalesce((select jsonb_agg(game_player_json(x) order by i) from unnest(v_team) with ordinality as u(x, i)), '[]'),
    'friends', coalesce((
      select jsonb_agg(game_player_json(f.id) order by f.together desc, f.id) from (
        select u.id, (
          select count(*) from game_players a join game_players b on b.game_id = a.game_id and b.user_id = u.id and b.status = 'joined'
          where a.user_id = app_uid() and a.status = 'joined') as together
        from friend_links fl
        join users u on u.id = case when fl.requester_id = app_uid() then fl.addressee_id else fl.requester_id end
        where fl.status = 'accepted' and (fl.requester_id = app_uid() or fl.addressee_id = app_uid()) and u.suspended_at is null
        order by together desc, u.id limit 12
      ) f
    ), '[]'),
    'me', game_player_json(app_uid())
  );
end;
$$;

-- Tells the host's friends that an online match is open (once per match).
create or replace function public.notify_game_room(p_code text, p_court uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_host users;
  v_court text;
  v_n int;
begin
  select * into v_host from users where id = app_uid();
  select name into v_court from courts where id = p_court;
  if v_host.id is null or v_court is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into notifications (user_id, type, title, body, data, dedupe_key, push)
  select u.id, 'jeu',
         case when u.locale = 'fr' then v_host.first_name || ' a lancé un match en ligne'
              else v_host.first_name || ' started an online match' end,
         case when u.locale = 'fr' then 'Mode Jeu à ' || v_court || ' : prends un joueur libre et joue avec ton avatar.'
              else 'Game Mode at ' || v_court || ': take a free player and play with your avatar.' end,
         jsonb_build_object('kind', 'jeu_room', 'code', p_code, 'court_id', p_court, 'user_id', v_host.id),
         'jeu:' || p_code || ':' || u.id, true
  from friend_links fl
  join users u on u.id = case when fl.requester_id = v_host.id then fl.addressee_id else fl.requester_id end
  where fl.status = 'accepted' and (fl.requester_id = v_host.id or fl.addressee_id = v_host.id) and u.suspended_at is null
  on conflict (dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
