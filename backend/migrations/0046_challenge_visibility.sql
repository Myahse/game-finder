-- Challenge visibility: a direct challenge is private (only its players and
-- invitees can see it) unless the challenger makes it public, so anyone with
-- the link can follow it. Open challenges are always public. Players also get
-- told when the challenger rewrites the message.

alter table public.challenges add column if not exists is_public boolean not null default false;

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
    'is_public', c.is_public or c.opponent_id is null,
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

create or replace function public.set_challenge_visibility(p_id uuid, p_public boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_c challenges;
begin
  if app_uid() is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_c.challenger_id <> app_uid() and not is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.opponent_id is null and not coalesce(p_public, false) then
    raise exception 'open_challenge_public' using errcode = 'P0001';
  end if;
  update challenges set is_public = coalesce(p_public, false) where id = p_id
  returning * into v_c;
  return challenge_json(v_c);
end;
$$;

create or replace function public.update_challenge_message(p_id uuid, p_message text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_c challenges;
  v_old text;
  v_name text;
begin
  if v_uid is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
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
  if char_length(coalesce(p_message, '')) > 140 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  v_old := v_c.message;
  update challenges set message = nullif(trim(p_message), '') where id = p_id
  returning * into v_c;

  if v_c.message is not null and v_c.message is distinct from v_old then
    select '@' || username into v_name from users where id = v_uid;
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    select cp.user_id, 'challenge', '💬 ' || coalesce(v_name, 'The challenger') || ' updated the challenge',
           '“' || v_c.message || '”',
           jsonb_build_object('kind', 'challenge', 'challenge_id', p_id),
           'challenge:' || p_id || ':message:' || cp.user_id || ':' || clock_timestamp()
    from challenge_players cp
    where cp.challenge_id = p_id and cp.status in ('invited', 'accepted') and cp.user_id <> v_uid
    on conflict (dedupe_key) do nothing;
  end if;
  return challenge_json(v_c);
end;
$$;
