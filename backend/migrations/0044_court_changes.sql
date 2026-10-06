-- Move a game or a challenge to another court (rain, court taken…). Every
-- player gets a notification and, in the app, an alert to acknowledge.

create table if not exists public.court_changes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete cascade,
  from_court_id uuid references public.courts (id) on delete set null,
  to_court_id uuid not null references public.courts (id) on delete cascade,
  changed_by uuid references public.users (id) on delete set null,
  reason text check (reason in ('rain', 'other')),
  created_at timestamptz not null default now(),
  check (game_id is not null or challenge_id is not null)
);
create index if not exists court_changes_game_idx on public.court_changes (game_id, created_at desc);
create index if not exists court_changes_challenge_idx on public.court_changes (challenge_id, created_at desc);

create table if not exists public.court_change_seen (
  change_id uuid not null references public.court_changes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (change_id, user_id)
);

create or replace function public.trg_game_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_joined int;
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.courts
      where id = new.court_id and public.court_is_playable(status)
    ) then
      raise exception 'court_not_available' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.court_sports where court_id = new.court_id and sport_id = new.sport_id
    ) then
      raise exception 'sport_not_offered_at_court' using errcode = 'P0001';
    end if;
    if new.start_time < now() - interval '15 minutes' then
      raise exception 'start_time_in_past' using errcode = 'P0001';
    end if;
    if new.start_time > now() + interval '30 days' then
      raise exception 'start_time_too_far' using errcode = 'P0001';
    end if;
    new.status := case when new.start_time <= now() then 'active' else 'scheduled' end;
    new.cancelled_reason := null;
  else
    -- Court moves go through move_game / move_challenge (host or challenger).
    if app_uid() is not null and not public.is_admin()
       and ((new.court_id <> old.court_id and coalesce(current_setting('app.court_move', true), '') <> 'on') or new.creator_id is distinct from old.creator_id) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    if new.max_players <> old.max_players then
      select count(*) into v_joined from public.game_players
      where game_id = new.id and status = 'joined';
      if new.max_players > 0 and new.max_players < v_joined then
        raise exception 'max_players_below_current' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Moves the game and/or challenge, records the change and notifies players.
create or replace function public.apply_court_move(p_game uuid, p_challenge uuid, p_court uuid, p_reason text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_sport uuid;
  v_from uuid;
  v_change uuid;
  v_name text;
  v_from_name text;
  v_to_name text;
  v_what text := case when p_challenge is not null then 'challenge' else 'game' end;
begin
  if p_reason is not null and p_reason not in ('rain', 'other') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if p_game is not null then
    select sport_id, court_id into v_sport, v_from from games where id = p_game;
  else
    select sport_id, court_id into v_sport, v_from from challenges where id = p_challenge;
  end if;
  if p_court = v_from then
    raise exception 'same_court' using errcode = 'P0001';
  end if;
  if not exists (select 1 from courts where id = p_court and court_is_playable(status)) then
    raise exception 'court_not_available' using errcode = 'P0001';
  end if;
  if not exists (select 1 from court_sports where court_id = p_court and sport_id = v_sport) then
    raise exception 'sport_not_offered_at_court' using errcode = 'P0001';
  end if;

  if p_game is not null then
    perform set_config('app.court_move', 'on', true);
    update games set court_id = p_court where id = p_game;
    perform set_config('app.court_move', '', true);
  end if;
  if p_challenge is not null then
    update challenges set court_id = p_court where id = p_challenge;
  end if;
  insert into court_changes (game_id, challenge_id, from_court_id, to_court_id, changed_by, reason)
  values (p_game, p_challenge, v_from, p_court, v_uid, p_reason)
  returning id into v_change;
  insert into court_change_seen (change_id, user_id) values (v_change, v_uid) on conflict do nothing;

  select '@' || username into v_name from users where id = v_uid;
  select name into v_from_name from courts where id = v_from;
  select name into v_to_name from courts where id = p_court;
  insert into notifications (user_id, type, title, body, data, dedupe_key, push)
  select r.user_id, 'game_activity',
         '📍 ' || initcap(v_what) || ' moved to ' || v_to_name,
         coalesce(v_name, 'An admin') || ' moved the ' || v_what || ' from ' || coalesce(v_from_name, 'the old court') || ' to ' || v_to_name
           || case when p_reason = 'rain' then ' because of rain.' else '.' end,
         jsonb_build_object('kind', 'court_change', 'change_id', v_change, 'game_id', p_game, 'challenge_id', p_challenge, 'court_id', p_court),
         'court_change:' || v_change || ':' || r.user_id,
         true
  from (
    select gp.user_id from game_players gp where gp.game_id = p_game and gp.status = 'joined'
    union
    select cp.user_id from challenge_players cp where cp.challenge_id = p_challenge and cp.status in ('invited', 'accepted')
  ) r
  where r.user_id is distinct from v_uid
  on conflict (dedupe_key) do nothing;
  return v_change;
end;
$$;

-- Host (or admin) moves a scheduled/active game. A challenge's game moves the challenge too.
create or replace function public.move_game(p_game uuid, p_court uuid, p_reason text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_g games;
  v_challenge uuid;
begin
  if app_uid() is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_g from games where id = p_game for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0001';
  end if;
  if v_g.creator_id is distinct from app_uid() and not is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_g.status not in ('scheduled', 'active') then
    raise exception 'game_closed' using errcode = 'P0001';
  end if;
  select id into v_challenge from challenges where game_id = p_game and status in ('pending', 'accepted', 'reported') limit 1;
  return apply_court_move(p_game, v_challenge, p_court, p_reason);
end;
$$;

-- Challenger (or admin) moves a challenge that is still on.
create or replace function public.move_challenge(p_id uuid, p_court uuid, p_reason text)
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
  if v_c.status not in ('pending', 'accepted') or (v_c.status = 'pending' and not challenge_is_live(v_c)) then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if v_c.game_id is not null and exists (select 1 from games where id = v_c.game_id and status not in ('scheduled', 'active')) then
    raise exception 'game_closed' using errcode = 'P0001';
  end if;
  perform apply_court_move(v_c.game_id, p_id, p_court, p_reason);
  select * into v_c from challenges where id = p_id;
  return challenge_json(v_c);
end;
$$;

-- Unacknowledged moves of my upcoming games/challenges (latest per game or challenge).
create or replace function public.my_court_changes()
returns jsonb
language sql
stable
set search_path = public
as $$
  with mine as (
    select distinct on (coalesce(cc.challenge_id, cc.game_id)) cc.*
    from court_changes cc
    left join games g on g.id = cc.game_id
    left join challenges ch on ch.id = cc.challenge_id
    where cc.created_at > now() - interval '7 days'
      and cc.changed_by is distinct from app_uid()
      and not exists (select 1 from court_change_seen s where s.change_id = cc.id and s.user_id = app_uid())
      and (
        (g.id is not null and g.status in ('scheduled', 'active')
          and exists (select 1 from game_players gp where gp.game_id = g.id and gp.user_id = app_uid() and gp.status = 'joined'))
        or (ch.id is not null and ch.status in ('pending', 'accepted')
          and exists (select 1 from challenge_players cp where cp.challenge_id = ch.id and cp.user_id = app_uid() and cp.status in ('invited', 'accepted')))
      )
    order by coalesce(cc.challenge_id, cc.game_id), cc.created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'game_id', m.game_id,
    'challenge_id', m.challenge_id,
    'reason', m.reason,
    'created_at', m.created_at,
    'changed_by', (select user_public_json(u) from users u where u.id = m.changed_by),
    'from_court', (select jsonb_build_object('id', c.id, 'name', c.name) from courts c where c.id = m.from_court_id),
    'to_court', (select jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'latitude', c.latitude, 'longitude', c.longitude)
                 from courts c where c.id = m.to_court_id),
    'sport', (select sport_json(s) from sports s where s.id = coalesce(
                (select sport_id from games where id = m.game_id), (select sport_id from challenges where id = m.challenge_id))),
    'start_time', coalesce((select start_time from games where id = m.game_id), (select start_time from challenges where id = m.challenge_id))
  ) order by m.created_at desc), '[]')
  from mine m;
$$;

-- Acknowledge a move (and any earlier ones of the same game/challenge).
create or replace function public.ack_court_change(p_id uuid)
returns void
language sql
set search_path = public
as $$
  insert into court_change_seen (change_id, user_id)
  select cc.id, app_uid()
  from court_changes cc
  join court_changes me on me.id = p_id
  where app_uid() is not null
    and cc.created_at <= me.created_at
    and (cc.game_id = me.game_id or cc.challenge_id = me.challenge_id)
  on conflict do nothing;
$$;

-- French notification text for moves; everything else goes through the existing templates.
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
    select t.title, t.body into v_title, v_body from notification_text_fr(new.title, new.body) t;
    new.title := coalesce(v_title, new.title);
    new.body := coalesce(v_body, new.body);
  end if;
  return new;
end;
$$;
