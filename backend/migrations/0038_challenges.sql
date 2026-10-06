-- Challenges ("défis"): a player challenges another player (or anyone at a court)
-- to a sport-specific format — live now or at a set time. Accepting creates a
-- match game with the two sides as teams; one side reports the result, the other
-- confirms (auto-confirmed after 24 h), which feeds ratings, rankings and badges.

alter type public.notification_type add value if not exists 'challenge';

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id),
  format text not null,
  team_size smallint not null check (team_size between 1 and 6),
  challenger_id uuid not null references public.users (id) on delete cascade,
  opponent_id uuid references public.users (id) on delete cascade, -- null = open challenge
  court_id uuid not null references public.courts (id) on delete cascade,
  start_time timestamptz not null,
  message text check (char_length(message) <= 140),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'reported', 'completed')),
  game_id uuid references public.games (id) on delete set null,
  winner_id uuid references public.users (id) on delete set null,
  score_challenger text check (char_length(score_challenger) <= 12),
  score_opponent text check (char_length(score_opponent) <= 12),
  reported_by uuid references public.users (id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  completed_at timestamptz,
  check (opponent_id is null or opponent_id <> challenger_id)
);
create index if not exists challenges_challenger_idx on public.challenges (challenger_id, status);
create index if not exists challenges_opponent_idx on public.challenges (opponent_id, status);
create index if not exists challenges_open_idx on public.challenges (court_id) where opponent_id is null and status = 'pending';

-- Formats per sport: id, players per side, game length (minutes).
create or replace function public.challenge_formats(p_slug text)
returns table (id text, team_size int, minutes int)
language sql
immutable
as $$
  select f.id, f.team_size, f.minutes from (values
    ('basketball', 'bball_1v1_11', 1, 30),
    ('basketball', 'bball_1v1_21', 1, 45),
    ('basketball', 'bball_horse', 1, 30),
    ('basketball', 'bball_3pt', 1, 20),
    ('basketball', 'bball_2v2', 2, 60),
    ('basketball', 'bball_3v3', 3, 60),
    ('football', 'foot_1v1', 1, 30),
    ('football', 'foot_penalties', 1, 20),
    ('football', 'foot_juggling', 1, 15),
    ('football', 'foot_2v2', 2, 45),
    ('football', 'foot_5v5', 5, 60),
    ('volleyball', 'volley_1v1', 1, 30),
    ('volleyball', 'volley_serve', 1, 20),
    ('volleyball', 'volley_2v2', 2, 60),
    ('volleyball', 'volley_3v3', 3, 60),
    ('tennis', 'tennis_tiebreak', 1, 30),
    ('tennis', 'tennis_1set', 1, 60),
    ('tennis', 'tennis_bo3', 1, 120),
    ('tennis', 'tennis_doubles', 2, 90),
    ('badminton', 'badm_21', 1, 30),
    ('badminton', 'badm_bo3', 1, 60),
    ('badminton', 'badm_doubles', 2, 60)
  ) as f(slug, id, team_size, minutes)
  where f.slug = p_slug;
$$;

create or replace function public.challenge_json(c public.challenges)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'sport', (select sport_json(s) from sports s where s.id = c.sport_id),
    'format', c.format,
    'team_size', c.team_size,
    'challenger', (select user_public_json(u) from users u where u.id = c.challenger_id),
    'opponent', (select user_public_json(u) from users u where u.id = c.opponent_id),
    'court', (select jsonb_build_object('id', ct.id, 'name', ct.name, 'latitude', ct.latitude, 'longitude', ct.longitude) from courts ct where ct.id = c.court_id),
    'start_time', c.start_time,
    'message', c.message,
    'status', c.status,
    'is_open', c.opponent_id is null,
    'game_id', c.game_id,
    'winner_id', c.winner_id,
    'score_challenger', c.score_challenger,
    'score_opponent', c.score_opponent,
    'reported_by', c.reported_by,
    'created_at', c.created_at
  );
$$;

-- Live challenges stay acceptable 30 min after their start time.
create or replace function public.challenge_is_live(c public.challenges)
returns boolean
language sql
stable
as $$ select c.status = 'pending' and c.start_time > now() - interval '30 minutes' $$;

create or replace function public.create_challenge(
  p_opponent uuid, p_sport uuid, p_format text, p_court uuid, p_start timestamptz, p_message text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_slug text;
  v_size int;
  v_start timestamptz := coalesce(p_start, now());
  v_c challenges;
  v_name text;
  v_court text;
  v_when text;
begin
  if v_uid is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_opponent is not null then
    if p_opponent = v_uid then
      raise exception 'invalid_input' using errcode = 'P0001';
    end if;
    if not exists (select 1 from users where id = p_opponent and suspended_at is null) then
      raise exception 'user_not_found' using errcode = 'P0001';
    end if;
  end if;
  select slug into v_slug from sports where id = p_sport and active;
  select f.team_size into v_size from challenge_formats(v_slug) f where f.id = p_format;
  if v_slug is null or v_size is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if not is_admin() and not user_matches_sport(v_uid, p_sport) then
    raise exception 'wrong_sport' using errcode = 'P0001';
  end if;
  if not exists (select 1 from courts where id = p_court and court_is_playable(status)) then
    raise exception 'court_not_available' using errcode = 'P0001';
  end if;
  if not exists (select 1 from court_sports where court_id = p_court and sport_id = p_sport) then
    raise exception 'sport_not_offered_at_court' using errcode = 'P0001';
  end if;
  if v_start < now() - interval '5 minutes' then
    raise exception 'start_time_in_past' using errcode = 'P0001';
  end if;
  if v_start > now() + interval '14 days' then
    raise exception 'start_time_too_far' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_message, '')) > 140 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if (select count(*) from challenges where challenger_id = v_uid and status = 'pending' and start_time > now() - interval '30 minutes') >= 10 then
    raise exception 'too_many_challenges' using errcode = 'P0001';
  end if;
  if p_opponent is not null and exists (
    select 1 from challenges c
    where c.challenger_id = v_uid and c.opponent_id = p_opponent and c.sport_id = p_sport and challenge_is_live(c)
  ) then
    raise exception 'challenge_pending' using errcode = 'P0001';
  end if;

  insert into challenges (sport_id, format, team_size, challenger_id, opponent_id, court_id, start_time, message)
  values (p_sport, p_format, v_size, v_uid, p_opponent, p_court, v_start, nullif(trim(p_message), ''))
  returning * into v_c;

  select '@' || username into v_name from users where id = v_uid;
  select name into v_court from courts where id = p_court;
  v_when := case when v_start <= now() + interval '10 minutes' then 'now' else 'at ' || to_char(v_start at time zone 'UTC', 'Dy HH24:MI') || ' UTC' end;

  if p_opponent is not null then
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    values (p_opponent, 'challenge', '⚔️ ' || v_name || ' challenges you',
            'At ' || v_court || ' ' || v_when || '. Accept or decline.',
            jsonb_build_object('kind', 'challenge', 'challenge_id', v_c.id),
            'challenge:' || v_c.id || ':new')
    on conflict (dedupe_key) do nothing;
  else
    -- Open challenge: players checked in at that court and the challenger's friends who play the sport.
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    select x.uid, 'challenge', '⚔️ Open challenge at ' || v_court,
           v_name || ' is looking for an opponent ' || v_when || '. First to accept plays.',
           jsonb_build_object('kind', 'challenge', 'challenge_id', v_c.id, 'court_id', p_court),
           'challenge:' || v_c.id || ':open:' || x.uid
    from (
      select cp.user_id as uid from court_presence cp where cp.court_id = p_court and cp.status = 'active'
      union
      select case when fl.requester_id = v_uid then fl.addressee_id else fl.requester_id end
      from friend_links fl
      where fl.status = 'accepted' and (fl.requester_id = v_uid or fl.addressee_id = v_uid)
    ) x
    join users u on u.id = x.uid and u.suspended_at is null
    where x.uid <> v_uid and user_matches_sport(x.uid, p_sport)
    on conflict (dedupe_key) do nothing;
  end if;

  return challenge_json(v_c);
end;
$$;

-- Accept (opponent, or anyone for an open challenge) or decline (opponent).
create or replace function public.respond_challenge(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_slug text;
  v_minutes int;
  v_game uuid;
  v_me text;
  v_them text;
begin
  if v_uid is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_c.status <> 'pending' and v_uid <> v_c.challenger_id then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_c.challenger_id = v_uid or (v_c.opponent_id is not null and v_c.opponent_id <> v_uid) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if not challenge_is_live(v_c) then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  select '@' || username into v_me from users where id = v_uid;

  if not p_accept then
    if v_c.opponent_id is null then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    update challenges set status = 'declined', responded_at = now() where id = p_id returning * into v_c;
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    values (v_c.challenger_id, 'challenge', v_me || ' declined your challenge', 'Maybe next time. Try someone else?',
            jsonb_build_object('kind', 'challenge', 'challenge_id', p_id), 'challenge:' || p_id || ':declined')
    on conflict (dedupe_key) do nothing;
    return challenge_json(v_c);
  end if;

  select s.slug into v_slug from sports s where s.id = v_c.sport_id;
  select f.minutes into v_minutes from challenge_formats(v_slug) f where f.id = v_c.format;

  insert into games (court_id, sport_id, creator_id, start_time, max_players, skill_level, game_type, duration_minutes)
  values (v_c.court_id, v_c.sport_id, v_c.challenger_id, greatest(v_c.start_time, now()), 2 * v_c.team_size,
          'all_levels', 'match', coalesce(v_minutes, 30))
  returning id into v_game;
  insert into game_players (game_id, user_id) values (v_game, v_uid) on conflict (game_id, user_id) do nothing;

  select '@' || username into v_them from users where id = v_c.challenger_id;
  insert into game_teams (game_id, position, name, color, score)
  values (v_game, 0, left(v_them, 24), '#ff5a1f', 0), (v_game, 1, left(v_me, 24), '#1f6fff', 0);
  insert into game_team_players (game_id, team_id, user_id)
  select v_game, t.id, case t.position when 0 then v_c.challenger_id else v_uid end
  from game_teams t where t.game_id = v_game;

  update challenges set status = 'accepted', opponent_id = v_uid, game_id = v_game, responded_at = now()
  where id = p_id returning * into v_c;

  insert into notifications (user_id, type, title, body, data, dedupe_key)
  values (v_c.challenger_id, 'challenge', '🔥 ' || v_me || ' accepted your challenge',
          'Game on! See you at the court.',
          jsonb_build_object('kind', 'challenge', 'challenge_id', p_id, 'game_id', v_game), 'challenge:' || p_id || ':accepted')
  on conflict (dedupe_key) do nothing;
  return challenge_json(v_c);
end;
$$;

create or replace function public.cancel_challenge(p_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
begin
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_c.challenger_id <> v_uid and not is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.status not in ('pending', 'accepted') then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_c.game_id is not null then
    update games set status = 'cancelled', cancelled_reason = 'Challenge cancelled'
    where id = v_c.game_id and status in ('scheduled', 'active');
  end if;
  update challenges set status = 'cancelled', responded_at = coalesce(responded_at, now()) where id = p_id returning * into v_c;
  if v_c.opponent_id is not null then
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    select v_c.opponent_id, 'challenge', 'Challenge cancelled', '@' || u.username || ' cancelled the challenge.',
           jsonb_build_object('kind', 'challenge', 'challenge_id', p_id), 'challenge:' || p_id || ':cancelled'
    from users u where u.id = v_c.challenger_id
    on conflict (dedupe_key) do nothing;
  end if;
  return challenge_json(v_c);
end;
$$;

-- Either side reports the winner (+ optional scores, e.g. "21" / "12.4s").
create or replace function public.report_challenge(p_id uuid, p_winner uuid, p_score_challenger text, p_score_opponent text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_other uuid;
begin
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_uid not in (v_c.challenger_id, v_c.opponent_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.status not in ('accepted', 'reported') then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_c.status = 'reported' and v_c.reported_by <> v_uid then
    raise exception 'result_awaiting_you' using errcode = 'P0001';
  end if;
  if (select start_time from games where id = v_c.game_id) > now() + interval '15 minutes' then
    raise exception 'game_not_started' using errcode = 'P0001';
  end if;
  if p_winner is null or p_winner not in (v_c.challenger_id, v_c.opponent_id)
     or char_length(coalesce(p_score_challenger, '')) > 12 or char_length(coalesce(p_score_opponent, '')) > 12 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  update challenges set status = 'reported', winner_id = p_winner, reported_by = v_uid, reported_at = now(),
    score_challenger = nullif(trim(p_score_challenger), ''), score_opponent = nullif(trim(p_score_opponent), '')
  where id = p_id returning * into v_c;

  v_other := case when v_uid = v_c.challenger_id then v_c.opponent_id else v_c.challenger_id end;
  insert into notifications (user_id, type, title, body, data, dedupe_key)
  select v_other, 'challenge', 'Confirm the result',
         '@' || u.username || ' reported ' || case when p_winner = v_other then 'a win for you' else 'a win for them' end
           || '. Confirm or dispute within 24 h.',
         jsonb_build_object('kind', 'challenge', 'challenge_id', p_id),
         'challenge:' || p_id || ':reported:' || clock_timestamp()
  from users u where u.id = v_uid
  on conflict (dedupe_key) do nothing;
  return challenge_json(v_c);
end;
$$;

-- Writes a confirmed result into the game (team scores) and finishes the challenge.
create or replace function public.finish_challenge(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_c challenges;
  v_a int;
  v_b int;
  v_win_pos int;
begin
  select * into v_c from challenges where id = p_id for update;
  if v_c.status <> 'reported' then
    return;
  end if;
  v_win_pos := case when v_c.winner_id = v_c.challenger_id then 0 else 1 end;
  -- Numeric scores feed the scoreboard as-is when they agree with the winner; otherwise 1–0.
  if coalesce(v_c.score_challenger, '') ~ '^\d{1,3}$' and coalesce(v_c.score_opponent, '') ~ '^\d{1,3}$'
     and ((v_win_pos = 0 and v_c.score_challenger::int > v_c.score_opponent::int)
          or (v_win_pos = 1 and v_c.score_opponent::int > v_c.score_challenger::int)) then
    v_a := v_c.score_challenger::int;
    v_b := v_c.score_opponent::int;
  else
    v_a := case when v_win_pos = 0 then 1 else 0 end;
    v_b := 1 - v_a;
  end if;
  if v_c.game_id is not null then
    update game_teams set score = case position when 0 then v_a else v_b end where game_id = v_c.game_id and position in (0, 1);
    insert into game_results (game_id, updated_by, updated_at) values (v_c.game_id, v_c.reported_by, now())
    on conflict (game_id) do update set updated_by = excluded.updated_by, updated_at = now();
    perform recompute_sport_ratings(v_c.sport_id);
  end if;
  update challenges set status = 'completed', completed_at = now() where id = p_id;
  perform sync_badges(v_c.challenger_id);
  perform sync_badges(v_c.opponent_id);
end;
$$;

create or replace function public.confirm_challenge(p_id uuid, p_ok boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
begin
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_uid not in (v_c.challenger_id, v_c.opponent_id) or v_uid = v_c.reported_by then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.status <> 'reported' then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if p_ok then
    perform finish_challenge(p_id);
  else
    update challenges set status = 'accepted', winner_id = null, reported_by = null, reported_at = null,
      score_challenger = null, score_opponent = null
    where id = p_id;
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    select v_c.reported_by, 'challenge', 'Result disputed', '@' || u.username || ' disputed the result. Report it again together.',
           jsonb_build_object('kind', 'challenge', 'challenge_id', p_id),
           'challenge:' || p_id || ':disputed:' || clock_timestamp()
    from users u where u.id = v_uid
    on conflict (dedupe_key) do nothing;
  end if;
  select * into v_c from challenges where id = p_id;
  return challenge_json(v_c);
end;
$$;

create or replace function public.my_challenges()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                          where c.opponent_id = app_uid() and challenge_is_live(c)), '[]'),
    'outgoing', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                          where c.challenger_id = app_uid() and challenge_is_live(c)), '[]'),
    'active', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                        where (c.challenger_id = app_uid() or c.opponent_id = app_uid())
                          and c.status in ('accepted', 'reported')), '[]'),
    'history', coalesce((select jsonb_agg(challenge_json(c) order by c.created_at desc) from challenges c
                         where c.id in (
                           select x.id from challenges x
                           where (x.challenger_id = app_uid() or x.opponent_id = app_uid())
                             and (x.status in ('completed', 'declined', 'cancelled', 'expired')
                                  or (x.status = 'pending' and not challenge_is_live(x)))
                           order by x.created_at desc limit 20)), '[]'),
    'record', (select jsonb_build_object(
                 'wins', count(*) filter (where winner_id = app_uid()),
                 'losses', count(*) filter (where winner_id is not null and winner_id <> app_uid()))
               from challenges
               where status = 'completed' and (challenger_id = app_uid() or opponent_id = app_uid()))
  );
$$;

create or replace function public.open_challenges_at(p_court uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(challenge_json(c) order by c.start_time), '[]')
  from challenges c
  where c.court_id = p_court and c.opponent_id is null and challenge_is_live(c);
$$;

-- My record against another player.
create or replace function public.head_to_head(p_other uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'wins', count(*) filter (where c.winner_id = app_uid()),
    'losses', count(*) filter (where c.winner_id = p_other),
    'played', count(*)
  )
  from challenges c
  where c.status = 'completed'
    and ((c.challenger_id = app_uid() and c.opponent_id = p_other) or (c.challenger_id = p_other and c.opponent_id = app_uid()));
$$;

-- Expire stale challenges and auto-confirm results nobody disputed in 24 h.
create or replace function public.challenge_tick()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_expired int;
  v_confirmed int := 0;
  v_id uuid;
begin
  update challenges c set status = 'expired'
  where c.status = 'pending' and c.start_time <= now() - interval '30 minutes';
  get diagnostics v_expired = row_count;

  -- Accepted challenges whose game was cancelled are cancelled too.
  update challenges c set status = 'cancelled'
  from games g
  where g.id = c.game_id and c.status in ('accepted', 'reported') and g.status = 'cancelled';

  for v_id in select id from challenges where status = 'reported' and reported_at <= now() - interval '24 hours' loop
    perform finish_challenge(v_id);
    v_confirmed := v_confirmed + 1;
  end loop;
  return jsonb_build_object('expired', v_expired, 'auto_confirmed', v_confirmed);
end;
$$;

-- Challenge wins count toward badges.
alter function public.player_stats(uuid) rename to player_stats_base;
create or replace function public.player_stats(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select player_stats_base(p_user) || jsonb_build_object(
    'challenge_wins', (select count(*) from challenges where status = 'completed' and winner_id = p_user)
  );
$$;

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
    ('social_10', 'friends', 10, 16, 'Connector'),
    ('duelist', 'challenge_wins', 1, 17, 'Duelist'),
    ('gunslinger', 'challenge_wins', 10, 18, 'Gunslinger')
$$;
