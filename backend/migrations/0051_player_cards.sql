-- Player cards: a shareable card per player and sport with a 40–99 rating and
-- a tier from the sport's Elo. Ratings now keep a per-game history (for the
-- 30-day Elo change) and a tier going up sends one notification.

-- Rating of each player after each scored game, rebuilt by every replay.
create table if not exists public.player_rating_history (
  sport_id uuid not null references public.sports (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  played_at timestamptz not null,
  rating double precision not null,
  primary key (sport_id, user_id, game_id)
);
create index if not exists player_rating_history_user_idx on public.player_rating_history (user_id, sport_id, played_at desc);

-- Last tier announced per player and sport, so replays don't announce again.
create table if not exists public.player_card_tiers (
  user_id uuid not null references public.users (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete cascade,
  tier text not null check (tier in ('bronze', 'argent', 'or', 'feu')),
  updated_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);

-- Tier from an Elo rating: bronze < 1200 ≤ argent < 1400 ≤ or < 1600 ≤ feu.
create or replace function public.card_tier(p_elo double precision)
returns text
language sql
immutable
as $$
  select case
    when round(p_elo) >= 1600 then 'feu'
    when round(p_elo) >= 1400 then 'or'
    when round(p_elo) >= 1200 then 'argent'
    else 'bronze'
  end;
$$;

create or replace function public.card_tier_rank(p_tier text)
returns int
language sql
immutable
as $$
  select array_position(array['bronze', 'argent', 'or', 'feu'], p_tier) - 1;
$$;

-- Same replay as 0037, plus the rating history and tier-up notifications.
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
  delete from player_rating_history where sport_id = p_sport;
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

    insert into player_rating_history (sport_id, user_id, game_id, played_at, rating)
    select p_sport, tp.user_id, v_game, g.start_time, pr.rating
    from game_team_players tp
    join games g on g.id = tp.game_id
    join player_ratings pr on pr.user_id = tp.user_id and pr.sport_id = p_sport
    where tp.game_id = v_game;
  end loop;

  perform announce_card_tiers(p_sport);
end;
$$;

-- Notifies players whose tier for the sport went up since the last announcement,
-- then stores the current tiers.
create or replace function public.announce_card_tiers(p_sport uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, body, data, dedupe_key, push)
  select pr.user_id, 'achievement',
         'Your card is now ' || l.en,
         'You reached the ' || initcap(l.en) || ' tier in ' || s.name || '. Show off your new card!',
         jsonb_build_object('kind', 'card_tier', 'tier', card_tier(pr.rating), 'sport', s.slug),
         'card_tier:' || pr.user_id || ':' || p_sport || ':' || card_tier(pr.rating), true
  from player_ratings pr
  join sports s on s.id = pr.sport_id
  join (values ('argent', 'SILVER'), ('or', 'GOLD'), ('feu', 'FIRE')) l (tier, en) on l.tier = card_tier(pr.rating)
  left join player_card_tiers ct on ct.user_id = pr.user_id and ct.sport_id = pr.sport_id
  where pr.sport_id = p_sport
    and card_tier_rank(card_tier(pr.rating)) > coalesce(card_tier_rank(ct.tier), 0)
  on conflict (dedupe_key) do nothing;

  insert into player_card_tiers (user_id, sport_id, tier)
  select pr.user_id, p_sport, card_tier(pr.rating) from player_ratings pr where pr.sport_id = p_sport
  on conflict (user_id, sport_id) do update set tier = excluded.tier, updated_at = now()
  where player_card_tiers.tier <> excluded.tier;
  delete from player_card_tiers ct
  where ct.sport_id = p_sport
    and not exists (select 1 from player_ratings pr where pr.user_id = ct.user_id and pr.sport_id = p_sport);
end;
$$;

-- Current tiers count as announced; then replay every sport to fill the history.
insert into public.player_card_tiers (user_id, sport_id, tier)
select user_id, sport_id, public.card_tier(rating) from public.player_ratings
on conflict (user_id, sport_id) do nothing;
select public.recompute_sport_ratings(id) from public.sports;

-- ---------------------------------------------------------------------------
-- Everything a player card shows, for one sport (?sport slug, else the sport
-- with the most rated games, else the preferred sport).
-- ---------------------------------------------------------------------------
create or replace function public.player_card(p_user uuid, p_sport text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_u users;
  v_sport sports;
  v_rating double precision := 1000;
  v_rated int := 0;
  v_before double precision;
  v_games int := 0;
  v_wins int := 0;
  v_losses int := 0;
  v_streak int := 0;
  v_points int := 0;
  v_stat_games int := 0;
  v_best int := 0;
  v_score numeric;
  v_elo int;
begin
  select * into v_u from users where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  select s.* into v_sport from sports s where s.slug = p_sport;
  if not found then
    select s.* into v_sport from player_ratings pr join sports s on s.id = pr.sport_id
    where pr.user_id = p_user order by pr.games desc, s.slug limit 1;
  end if;
  if not found then
    select s.* into v_sport from sports s where s.id = v_u.preferred_sport_id;
  end if;

  if v_sport.id is not null then
    select pr.rating, pr.games into v_rating, v_rated
    from player_ratings pr where pr.user_id = p_user and pr.sport_id = v_sport.id;
    v_rating := coalesce(v_rating, 1000);
    v_rated := coalesce(v_rated, 0);
    -- Rating 30 days ago: after the last game before then (1000 before any game).
    select h.rating into v_before from player_rating_history h
    where h.user_id = p_user and h.sport_id = v_sport.id and h.played_at < now() - interval '30 days'
    order by h.played_at desc limit 1;

    -- Scored games of the sport, by the same rules as the Elo replay.
    with sg as (
      select g.id, g.start_time,
             game_winner_position(g.id) as winner, t.position
      from game_team_players tp
      join games g on g.id = tp.game_id
      join game_teams t on t.id = tp.team_id
      where tp.user_id = p_user and g.sport_id = v_sport.id and g.status <> 'cancelled'
        and exists (select 1 from game_teams t2 where t2.game_id = g.id and t2.score > 0)
        and (select count(distinct tp2.team_id) from game_team_players tp2 where tp2.game_id = g.id) >= 2
    ),
    r as (select id, start_time, winner is not null and winner = position as won, winner is not null as decided from sg)
    select count(*), count(*) filter (where won), count(*) filter (where decided and not won),
           count(*) filter (where won and not exists (
             select 1 from r n where not n.won and (n.start_time, n.id) > (r.start_time, r.id)))
    into v_games, v_wins, v_losses, v_streak
    from r;

    select coalesce(sum((ps.stats ->> (sport_stat_keys(v_sport.slug))[1])::int), 0), count(*),
           coalesce(max((ps.stats ->> (sport_stat_keys(v_sport.slug))[1])::int), 0)
    into v_points, v_stat_games, v_best
    from game_player_stats ps join games g on g.id = ps.game_id
    where ps.user_id = p_user and g.sport_id = v_sport.id and g.status <> 'cancelled'
      and ps.stats ? (sport_stat_keys(v_sport.slug))[1];
  end if;

  -- 40–99: Elo, plus activity (≤ 4), winning (≤ 2) and the current streak (≤ 1).
  v_elo := round(v_rating);
  v_score := 40 + (v_elo - 900) * 0.075
    + least(v_games, 40) / 10.0
    + greatest(0, case when v_games > 0 then v_wins::numeric / v_games else 0 end - 0.5) * 4
    + least(v_streak, 5) / 5.0;

  return jsonb_build_object(
    'user', user_public_json(v_u),
    'serial', (select count(*) from users u where (u.created_at, u.id) <= (v_u.created_at, v_u.id)),
    'sport', case when v_sport.id is not null then sport_json(v_sport) end,
    'sports', coalesce((
      select jsonb_agg(sport_json(s) order by pr.games desc, s.slug)
      from player_ratings pr join sports s on s.id = pr.sport_id
      where pr.user_id = p_user
    ), '[]'),
    'elo', v_elo,
    'elo_delta_30d', case when v_rated = 0 then 0 else v_elo - round(coalesce(v_before, 1000))::int end,
    'rated_games', v_rated,
    'rating', least(99, greatest(40, round(v_score)))::int,
    'tier', card_tier(v_rating),
    'level', (player_progress(p_user) ->> 'level')::int,
    'games', v_games,
    'wins', v_wins,
    'losses', v_losses,
    'win_pct', case when v_games > 0 then round(100.0 * v_wins / v_games)::int else 0 end,
    'win_streak', v_streak,
    'challenges_won', (
      select count(*) filter (where (c.winner_id = c.challenger_id) = (cp.side = 'challenger'))
      from challenges c join challenge_players cp on cp.challenge_id = c.id and cp.user_id = p_user and cp.status = 'accepted'
      where c.status = 'completed' and c.winner_id is not null),
    'challenges_lost', (
      select count(*) filter (where (c.winner_id = c.challenger_id) <> (cp.side = 'challenger'))
      from challenges c join challenge_players cp on cp.challenge_id = c.id and cp.user_id = p_user and cp.status = 'accepted'
      where c.status = 'completed' and c.winner_id is not null),
    'courts', (
      select count(distinct g.court_id) from game_players gp join games g on g.id = gp.game_id
      where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled' and g.start_time < now()),
    'badges', (select count(*) from user_badges where user_id = p_user),
    'mvps', (select count(*) from game_results r join games g on g.id = r.game_id
             where r.mvp_user_id = p_user and g.status <> 'cancelled'),
    'points_total', v_points,
    'points_per_game', case when v_stat_games > 0 then round(v_points::numeric / v_stat_games, 1) else 0 end,
    'best_points', v_best,
    'home_court', (
      select jsonb_build_object('id', c.id, 'name', c.name)
      from game_players gp join games g on g.id = gp.game_id join courts c on c.id = g.court_id
      where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled'
        and g.start_time < now() and g.sport_id = v_sport.id
      group by c.id, c.name order by count(*) desc, max(g.start_time) desc limit 1),
    'king_of', (
      select jsonb_build_object('id', c.id, 'name', c.name)
      from court_kings k join courts c on c.id = k.court_id
      where k.user_id = p_user and k.week_start = date_trunc('week', now() at time zone 'UTC')::date - 7
      order by k.score desc limit 1)
  );
end;
$$;

-- French text for tier-up notifications; everything else as in 0044.
create or replace function public.trg_localize_notification()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  m text[];
begin
  if (select u.locale from users u where u.id = new.user_id) = 'fr' then
    m := regexp_match(new.title, '^📍 (Game|Challenge) moved to (.*)$');
    if m is not null then
      new.title := '📍 ' || case m[1] when 'Game' then 'Match déplacé à ' else 'Défi déplacé à ' end || m[2];
      m := regexp_match(new.body, '^(.*) moved the (game|challenge) from (.*) to (.*?)( because of rain)?\.$');
      if m is not null then
        new.body := replace(m[1], 'An admin', 'Un admin') || ' a déplacé ' || case m[2] when 'game' then 'le match' else 'le défi' end
          || ' de ' || replace(m[3], 'the old court', 'l’ancien terrain') || ' à ' || m[4]
          || case when m[5] is not null then ' à cause de la pluie.' else '.' end;
      end if;
      return new;
    end if;
    m := regexp_match(new.title, '^Your card is now (SILVER|GOLD|FIRE)$');
    if m is not null then
      v_title := case m[1] when 'SILVER' then 'ARGENT' when 'GOLD' then 'OR' else 'FEU' end;
      new.title := 'Votre carte passe ' || v_title;
      m := regexp_match(new.body, '^You reached the .* tier in (.*)\. Show off your new card!$');
      if m is not null then
        new.body := 'Vous atteignez le palier ' || initcap(v_title) || ' en ' || sport_name_fr(m[1]) || '. Montrez votre nouvelle carte !';
      end if;
      return new;
    end if;
    select t.title, t.body into v_title, v_body from notification_text_fr(new.title, new.body) t;
    new.title := coalesce(v_title, new.title);
    new.body := coalesce(v_body, new.body);
  end if;
  return new;
end;
$$;
