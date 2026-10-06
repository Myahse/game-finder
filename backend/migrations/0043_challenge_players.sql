-- Challenges with more players: the challenger (or anyone already in) can add
-- players — teammates on their side for team formats (2v2, 3v3, doubles…), or
-- more opponents (for 1v1, the first invitee to accept plays). Each side holds
-- team_size players; accepted players join the match game on their side's team.

create table if not exists public.challenge_players (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  side text not null check (side in ('challenger', 'opponent')),
  status text not null check (status in ('invited', 'accepted', 'declined')),
  invited_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_players_user_idx on public.challenge_players (user_id, status);

-- Existing challenges: challenger + opponent as players.
insert into public.challenge_players (challenge_id, user_id, side, status, invited_by, created_at)
select c.id, c.challenger_id, 'challenger', 'accepted', c.challenger_id, c.created_at from public.challenges c
on conflict do nothing;
insert into public.challenge_players (challenge_id, user_id, side, status, invited_by, created_at)
select c.id, c.opponent_id, 'opponent',
       case when c.status in ('accepted', 'reported', 'completed') then 'accepted'
            when c.status = 'declined' then 'declined' else 'invited' end,
       c.challenger_id, c.created_at
from public.challenges c where c.opponent_id is not null
on conflict do nothing;

-- New challenges seed their players.
create or replace function public.trg_challenge_players_init()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into challenge_players (challenge_id, user_id, side, status, invited_by)
  values (new.id, new.challenger_id, 'challenger', 'accepted', new.challenger_id)
  on conflict do nothing;
  if new.opponent_id is not null then
    insert into challenge_players (challenge_id, user_id, side, status, invited_by)
    values (new.id, new.opponent_id, 'opponent', 'invited', new.challenger_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists challenges_players_init on public.challenges;
create trigger challenges_players_init
  after insert on public.challenges
  for each row execute function public.trg_challenge_players_init();

-- Side of an accepted player, or null.
create or replace function public.challenge_side(p_id uuid, p_user uuid)
returns text
language sql
stable
set search_path = public
as $$
  select side from challenge_players where challenge_id = p_id and user_id = p_user and status = 'accepted';
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
    'created_at', c.created_at,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('user', user_public_json(u), 'side', cp.side, 'status', cp.status) order by cp.created_at)
      from challenge_players cp join users u on u.id = cp.user_id
      where cp.challenge_id = c.id and cp.status in ('invited', 'accepted')
    ), '[]'),
    'my_side', (select cp.side from challenge_players cp where cp.challenge_id = c.id and cp.user_id = app_uid()),
    'my_status', (select cp.status from challenge_players cp where cp.challenge_id = c.id and cp.user_id = app_uid())
  );
$$;

-- Add a player by @username to a side. Allowed for the challenger (any side)
-- and accepted players (their own side) while the challenge is open or on.
create or replace function public.add_challenge_player(p_id uuid, p_username text, p_side text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_target uuid;
  v_existing text;
  v_name text;
  v_court text;
  v_when text;
begin
  if v_uid is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if p_side not in ('challenger', 'opponent') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if v_c.status not in ('pending', 'accepted') or (v_c.status = 'pending' and not challenge_is_live(v_c)) then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_uid <> v_c.challenger_id and challenge_side(p_id, v_uid) is distinct from p_side then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if p_side = 'challenger' and v_c.team_size < 2 then
    raise exception 'side_full' using errcode = 'P0001';
  end if;
  if (select count(*) from challenge_players where challenge_id = p_id and side = p_side and status = 'accepted') >= v_c.team_size
     or (select count(*) from challenge_players where challenge_id = p_id and side = p_side and status = 'invited') >= v_c.team_size + 4 then
    raise exception 'side_full' using errcode = 'P0001';
  end if;

  select id into v_target from users where username = trim(leading '@' from trim(p_username))::citext and suspended_at is null;
  if v_target is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if v_target = v_uid then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  select status into v_existing from challenge_players where challenge_id = p_id and user_id = v_target;
  if v_existing in ('invited', 'accepted') then
    raise exception 'already_invited' using errcode = 'P0001';
  end if;

  insert into challenge_players (challenge_id, user_id, side, status, invited_by)
  values (p_id, v_target, p_side, 'invited', v_uid)
  on conflict (challenge_id, user_id) do update set side = excluded.side, status = 'invited', invited_by = excluded.invited_by, responded_at = null;

  select '@' || username into v_name from users where id = v_uid;
  select name into v_court from courts where id = v_c.court_id;
  v_when := case when v_c.start_time <= now() + interval '10 minutes' then 'now'
                 else 'at ' || to_char(v_c.start_time at time zone 'UTC', 'Dy HH24:MI') || ' UTC' end;
  insert into notifications (user_id, type, title, body, data, dedupe_key)
  values (v_target, 'challenge', '⚔️ ' || v_name || ' challenges you',
          'At ' || v_court || ' ' || v_when || '. Accept or decline.',
          jsonb_build_object('kind', 'challenge', 'challenge_id', p_id),
          'challenge:' || p_id || ':invite:' || v_target || ':' || clock_timestamp())
  on conflict (dedupe_key) do nothing;

  return challenge_json(v_c);
end;
$$;

-- Accept or decline an invitation (or take an open challenge).
create or replace function public.respond_challenge(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_me challenge_players;
  v_side text;
  v_slug text;
  v_minutes int;
  v_game uuid;
  v_me_name text;
  v_captain text;
begin
  if v_uid is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_c.status not in ('pending', 'accepted') or (v_c.status = 'pending' and not challenge_is_live(v_c)) then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;

  select * into v_me from challenge_players where challenge_id = p_id and user_id = v_uid;
  if found then
    if v_me.status = 'accepted' then
      raise exception 'not_allowed' using errcode = 'P0001';
    elsif v_me.status <> 'invited' then
      raise exception 'challenge_closed' using errcode = 'P0001';
    end if;
    v_side := v_me.side;
  elsif v_c.opponent_id is null and v_c.status = 'pending' and v_uid <> v_c.challenger_id then
    -- Open challenge: anyone can take the opponent side.
    if not p_accept then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    v_side := 'opponent';
  elsif v_c.status <> 'pending' then
    raise exception 'challenge_closed' using errcode = 'P0001';
  else
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  select '@' || username into v_me_name from users where id = v_uid;

  if not p_accept then
    update challenge_players set status = 'declined', responded_at = now() where challenge_id = p_id and user_id = v_uid;
    if v_c.status = 'pending' and v_side = 'opponent' and not exists (
      select 1 from challenge_players where challenge_id = p_id and side = 'opponent' and status in ('invited', 'accepted')
    ) then
      update challenges set status = 'declined', responded_at = now() where id = p_id returning * into v_c;
    end if;
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    values (v_c.challenger_id, 'challenge', v_me_name || ' declined your challenge', 'Maybe next time. Try someone else?',
            jsonb_build_object('kind', 'challenge', 'challenge_id', p_id), 'challenge:' || p_id || ':declined:' || v_uid)
    on conflict (dedupe_key) do nothing;
    return challenge_json(v_c);
  end if;

  if (select count(*) from challenge_players where challenge_id = p_id and side = v_side and status = 'accepted') >= v_c.team_size then
    raise exception 'side_full' using errcode = 'P0001';
  end if;
  insert into challenge_players (challenge_id, user_id, side, status, invited_by, responded_at)
  values (p_id, v_uid, v_side, 'accepted', v_uid, now())
  on conflict (challenge_id, user_id) do update set status = 'accepted', responded_at = now();

  if v_c.status = 'pending' and v_side = 'opponent' then
    -- First opponent in: create the match with both sides as teams.
    select s.slug into v_slug from sports s where s.id = v_c.sport_id;
    select f.minutes into v_minutes from challenge_formats(v_slug) f where f.id = v_c.format;
    insert into games (court_id, sport_id, creator_id, start_time, max_players, skill_level, game_type, duration_minutes)
    values (v_c.court_id, v_c.sport_id, v_c.challenger_id, greatest(v_c.start_time, now()), 2 * v_c.team_size,
            'all_levels', 'match', coalesce(v_minutes, 30))
    returning id into v_game;
    select '@' || username into v_captain from users where id = v_c.challenger_id;
    insert into game_teams (game_id, position, name, color, score)
    values (v_game, 0, left(v_captain, 24), '#ff5a1f', 0), (v_game, 1, left(v_me_name, 24), '#1f6fff', 0);
    insert into game_players (game_id, user_id)
    select v_game, cp.user_id from challenge_players cp where cp.challenge_id = p_id and cp.status = 'accepted'
    on conflict (game_id, user_id) do nothing;
    insert into game_team_players (game_id, team_id, user_id)
    select v_game, t.id, cp.user_id
    from challenge_players cp
    join game_teams t on t.game_id = v_game and t.position = case cp.side when 'challenger' then 0 else 1 end
    where cp.challenge_id = p_id and cp.status = 'accepted'
    on conflict (game_id, user_id) do nothing;
    update challenges set status = 'accepted', opponent_id = v_uid, game_id = v_game, responded_at = now()
    where id = p_id returning * into v_c;
  elsif v_c.game_id is not null then
    -- Game already on: join it on my side's team.
    insert into game_players (game_id, user_id, status, joined_at, left_at)
    values (v_c.game_id, v_uid, 'joined', now(), null)
    on conflict (game_id, user_id) do update set status = 'joined', joined_at = now(), left_at = null;
    insert into game_team_players (game_id, team_id, user_id)
    select v_c.game_id, t.id, v_uid from game_teams t
    where t.game_id = v_c.game_id and t.position = case v_side when 'challenger' then 0 else 1 end
    on conflict (game_id, user_id) do update set team_id = excluded.team_id;
  end if;

  -- A full side closes its remaining invitations.
  if (select count(*) from challenge_players where challenge_id = p_id and side = v_side and status = 'accepted') >= v_c.team_size then
    update challenge_players set status = 'declined', responded_at = now()
    where challenge_id = p_id and side = v_side and status = 'invited';
  end if;

  insert into notifications (user_id, type, title, body, data, dedupe_key)
  values (v_c.challenger_id, 'challenge', '🔥 ' || v_me_name || ' accepted your challenge', 'Game on! See you at the court.',
          jsonb_build_object('kind', 'challenge', 'challenge_id', p_id, 'game_id', v_c.game_id),
          'challenge:' || p_id || ':accepted:' || v_uid)
  on conflict (dedupe_key) do nothing;
  select * into v_c from challenges where id = p_id;
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
  insert into notifications (user_id, type, title, body, data, dedupe_key)
  select cp.user_id, 'challenge', 'Challenge cancelled', '@' || u.username || ' cancelled the challenge.',
         jsonb_build_object('kind', 'challenge', 'challenge_id', p_id), 'challenge:' || p_id || ':cancelled:' || cp.user_id
  from challenge_players cp join users u on u.id = v_c.challenger_id
  where cp.challenge_id = p_id and cp.user_id <> v_c.challenger_id and cp.status in ('invited', 'accepted')
  on conflict (dedupe_key) do nothing;
  return challenge_json(v_c);
end;
$$;

-- Any player on a side reports the winner (the side captain's id); the other side confirms.
create or replace function public.report_challenge(p_id uuid, p_winner uuid, p_score_challenger text, p_score_opponent text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_side text;
begin
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  v_side := challenge_side(p_id, v_uid);
  if v_side is null then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.status not in ('accepted', 'reported') then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_c.status = 'reported' and challenge_side(p_id, v_c.reported_by) is distinct from v_side then
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

  insert into notifications (user_id, type, title, body, data, dedupe_key)
  select cp.user_id, 'challenge', 'Confirm the result',
         '@' || u.username || ' reported '
           || case when (p_winner = v_c.challenger_id) = (cp.side = 'challenger') then 'a win for you' else 'a win for them' end
           || '. Confirm or dispute within 24 h.',
         jsonb_build_object('kind', 'challenge', 'challenge_id', p_id),
         'challenge:' || p_id || ':reported:' || cp.user_id || ':' || clock_timestamp()
  from challenge_players cp join users u on u.id = v_uid
  where cp.challenge_id = p_id and cp.status = 'accepted' and cp.side <> v_side
  on conflict (dedupe_key) do nothing;
  return challenge_json(v_c);
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
  v_side text;
begin
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  v_side := challenge_side(p_id, v_uid);
  if v_side is null or (v_c.reported_by is not null and v_side = challenge_side(p_id, v_c.reported_by)) then
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

-- Badges for everyone who played.
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
  v_player uuid;
begin
  select * into v_c from challenges where id = p_id for update;
  if v_c.status <> 'reported' then
    return;
  end if;
  v_win_pos := case when v_c.winner_id = v_c.challenger_id then 0 else 1 end;
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
  for v_player in select user_id from challenge_players where challenge_id = p_id and status = 'accepted' loop
    perform sync_badges(v_player);
  end loop;
end;
$$;

-- Challenge wins count for every player on the winning side.
create or replace function public.player_stats(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select player_stats_base(p_user) || jsonb_build_object(
    'challenge_wins', (
      select count(*) from challenges c
      join challenge_players cp on cp.challenge_id = c.id and cp.user_id = p_user and cp.status = 'accepted'
      where c.status = 'completed'
        and ((c.winner_id = c.challenger_id and cp.side = 'challenger') or (c.winner_id = c.opponent_id and cp.side = 'opponent'))
    )
  );
$$;

create or replace function public.my_challenges()
returns jsonb
language sql
stable
set search_path = public
as $$
  with mine as (
    select cp.challenge_id, cp.side, cp.status from challenge_players cp where cp.user_id = app_uid()
  )
  select jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                          join mine m on m.challenge_id = c.id and m.status = 'invited'
                          where (c.status = 'pending' and challenge_is_live(c)) or c.status = 'accepted'), '[]'),
    'outgoing', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                          where c.challenger_id = app_uid() and challenge_is_live(c)), '[]'),
    'active', coalesce((select jsonb_agg(challenge_json(c) order by c.start_time) from challenges c
                        join mine m on m.challenge_id = c.id and m.status = 'accepted'
                        where c.status in ('accepted', 'reported')), '[]'),
    'history', coalesce((select jsonb_agg(challenge_json(c) order by c.created_at desc) from challenges c
                         where c.id in (
                           select x.id from challenges x join mine m on m.challenge_id = x.id
                           where x.status in ('completed', 'declined', 'cancelled', 'expired')
                              or (x.status = 'pending' and not challenge_is_live(x))
                           order by x.created_at desc limit 20)), '[]'),
    'record', (select jsonb_build_object(
                 'wins', count(*) filter (where (c.winner_id = c.challenger_id) = (m.side = 'challenger')),
                 'losses', count(*) filter (where (c.winner_id = c.challenger_id) <> (m.side = 'challenger')))
               from challenges c join mine m on m.challenge_id = c.id and m.status = 'accepted'
               where c.status = 'completed' and c.winner_id is not null)
  );
$$;
