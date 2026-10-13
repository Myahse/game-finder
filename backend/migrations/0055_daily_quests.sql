-- Daily quests and the daily streak.
--
-- Every player gets 3 quests a day (UTC, the same as Abidjan), picked from
-- real things the server can check: a check-in at a court, joining or playing
-- a game, creating one, adding a friend, a challenge, and Mode Jeu matches
-- when Mode Jeu is on. A quest is claimed once it's done: +20 XP, +30 for all
-- three. Claiming at least one quest a day keeps the streak; reaching 3, 7, 14
-- and 30 days in a row gives bonus XP. Quest XP counts in the player's level.

create table if not exists public.quest_claims (
  user_id uuid not null references public.users (id) on delete cascade,
  day date not null,
  quest text not null,
  xp int not null check (xp >= 0),
  at timestamptz not null default now(),
  primary key (user_id, day, quest)
);

create or replace function public.quest_today()
returns date
language sql
stable
as $$ select (now() at time zone 'UTC')::date $$;

-- The day's 3 quests for a player: one out on a court, one social, and one in
-- Mode Jeu (or a second court quest while Mode Jeu is off). Same answer all day.
create or replace function public.quest_ids(p_user uuid, p_day date, p_jeu boolean)
returns text[]
language sql
immutable
as $$
  with h as (select (('x' || substr(md5(p_user::text || ':' || p_day::text), 1, 8))::bit(32)::int & 2147483647) as n)
  select array[
    (array['checkin', 'join', 'play'])[1 + n % 3],
    (array['create', 'friend', 'challenge'])[1 + (n / 3) % 3],
    case when p_jeu then (array['jeu_play', 'jeu_win', 'jeu_online'])[1 + (n / 9) % 3]
         else (array['checkin', 'join', 'play'])[1 + (n % 3 + 1 + (n / 27) % 2) % 3] end
  ]
  from h;
$$;

-- Whether a player did a quest on a day (UTC).
create or replace function public.quest_done(p_user uuid, p_quest text, p_day date)
returns boolean
language sql
stable
set search_path = public
as $$
  with b as (select (p_day::timestamp at time zone 'UTC') as d0, ((p_day + 1)::timestamp at time zone 'UTC') as d1)
  select case p_quest
    when 'checkin' then exists (select 1 from court_presence p, b where p.user_id = p_user and p.started_at >= b.d0 and p.started_at < b.d1)
    when 'join' then exists (
      select 1 from game_players gp join games g on g.id = gp.game_id, b
      where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled'
        and g.creator_id is distinct from p_user and gp.joined_at >= b.d0 and gp.joined_at < b.d1)
    when 'play' then exists (
      select 1 from game_players gp join games g on g.id = gp.game_id, b
      where gp.user_id = p_user and gp.status = 'joined' and g.status <> 'cancelled'
        and g.start_time >= b.d0 and g.start_time < least(b.d1, now()))
    when 'create' then exists (select 1 from games g, b where g.creator_id = p_user and g.status <> 'cancelled' and g.created_at >= b.d0 and g.created_at < b.d1)
    when 'friend' then exists (
      select 1 from friend_links f, b
      where (f.requester_id = p_user and f.created_at >= b.d0 and f.created_at < b.d1)
         or (p_user in (f.requester_id, f.addressee_id) and f.status = 'accepted' and f.responded_at >= b.d0 and f.responded_at < b.d1))
    when 'challenge' then exists (select 1 from challenges c, b where c.challenger_id = p_user and c.created_at >= b.d0 and c.created_at < b.d1)
      or exists (select 1 from challenges c, b where c.opponent_id = p_user and c.status in ('accepted', 'completed') and c.responded_at >= b.d0 and c.responded_at < b.d1)
      or exists (select 1 from challenge_players cp, b where cp.user_id = p_user and cp.status = 'accepted' and cp.responded_at >= b.d0 and cp.responded_at < b.d1)
    when 'jeu_play' then exists (select 1 from game_xp x, b where x.user_id = p_user and x.at >= b.d0 and x.at < b.d1)
    when 'jeu_win' then exists (select 1 from game_xp x, b where x.user_id = p_user and x.won and x.at >= b.d0 and x.at < b.d1)
    when 'jeu_online' then exists (select 1 from game_xp x, b where x.user_id = p_user and x.mode = 'online' and x.at >= b.d0 and x.at < b.d1)
    else false
  end
  from b;
$$;

-- Days in a row with at least one claimed quest (today, or up to yesterday
-- while today is still open), and the best run.
create or replace function public.quest_streak(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with d as (select distinct day from quest_claims where user_id = p_user),
  isl as (select day, day - (row_number() over (order by day))::int as grp from d),
  runs as (select max(day) as e, count(*)::int as n from isl group by grp)
  select jsonb_build_object(
    'current', coalesce((select n from runs where e >= quest_today() - 1 order by e desc limit 1), 0),
    'best', coalesce((select max(n) from runs), 0),
    'today', exists (select 1 from d where day = quest_today())
  );
$$;

create or replace function public.quest_milestones()
returns int[][]
language sql
immutable
as $$ select array[[3, 30], [7, 70], [14, 140], [30, 300]] $$;

-- The day's quests, as the app shows them.
create or replace function public.daily_quests(p_user uuid, p_jeu boolean default false)
returns jsonb
language sql
stable
set search_path = public
as $$
  with q as (
    select x.id, x.ord, quest_done(p_user, x.id, quest_today()) as done,
           exists (select 1 from quest_claims c where c.user_id = p_user and c.day = quest_today() and c.quest = x.id) as claimed
    from unnest(quest_ids(p_user, quest_today(), p_jeu)) with ordinality as x(id, ord)
  ),
  st as (select quest_streak(p_user) as j)
  select jsonb_build_object(
    'day', quest_today(),
    'resets_at', (quest_today() + 1)::timestamp at time zone 'UTC',
    'quests', (select jsonb_agg(jsonb_build_object('id', id, 'xp', 20, 'done', done or claimed, 'claimed', claimed) order by ord) from q),
    'all', jsonb_build_object('xp', 30,
      'done', (select bool_and(done or claimed) from q),
      'claimed', exists (select 1 from quest_claims c where c.user_id = p_user and c.day = quest_today() and c.quest = 'all')),
    'streak', st.j,
    'milestones', (select jsonb_agg(jsonb_build_object('days', (quest_milestones())[i][1], 'xp', (quest_milestones())[i][2]) order by i) from generate_subscripts(quest_milestones(), 1) as i),
    'today_xp', coalesce((select sum(xp) from quest_claims c where c.user_id = p_user and c.day = quest_today()), 0)::int,
    'total_xp', coalesce((select sum(xp) from quest_claims c where c.user_id = p_user), 0)::int
  )
  from st;
$$;

-- Claims a done quest ('all' once the three are done) and gives the XP; on the
-- streak's 3rd, 7th, 14th and 30th day the first claim of the day adds a bonus.
create or replace function public.claim_quest(p_user uuid, p_quest text, p_jeu boolean default false)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_day date := quest_today();
  v_ids text[] := quest_ids(p_user, v_day, p_jeu);
  v_xp int;
  v_gained int := 0;
  v_first boolean;
  v_streak int;
  v_bonus int := 0;
  i int;
begin
  perform pg_advisory_xact_lock(hashtext('quest:' || p_user::text));
  if p_quest = 'all' then
    if exists (select 1 from unnest(v_ids) q where not quest_done(p_user, q, v_day)
               and not exists (select 1 from quest_claims c where c.user_id = p_user and c.day = v_day and c.quest = q)) then
      raise exception 'quest_not_done' using errcode = 'P0001';
    end if;
    v_xp := 30;
  elsif p_quest = any(v_ids) then
    if not quest_done(p_user, p_quest, v_day) then
      raise exception 'quest_not_done' using errcode = 'P0001';
    end if;
    -- three quests a day, whatever list the phone asked for
    if (select count(*) from quest_claims c where c.user_id = p_user and c.day = v_day and c.quest <> 'all' and c.quest not like 'streak_%') >= 3 then
      raise exception 'quest_not_done' using errcode = 'P0001';
    end if;
    v_xp := 20;
  else
    raise exception 'quest_not_done' using errcode = 'P0001';
  end if;

  v_first := not exists (select 1 from quest_claims c where c.user_id = p_user and c.day = v_day);
  insert into quest_claims (user_id, day, quest, xp) values (p_user, v_day, p_quest, v_xp) on conflict do nothing;
  if found then
    v_gained := v_xp;
    if v_first then
      v_streak := (quest_streak(p_user) ->> 'current')::int;
      for i in 1 .. array_length(quest_milestones(), 1) loop
        if (quest_milestones())[i][1] = v_streak then
          v_bonus := (quest_milestones())[i][2];
          insert into quest_claims (user_id, day, quest, xp) values (p_user, v_day, 'streak_' || v_streak, v_bonus) on conflict do nothing;
        end if;
      end loop;
    end if;
  end if;
  return daily_quests(p_user, p_jeu) || jsonb_build_object('gained', v_gained + v_bonus, 'bonus', v_bonus, 'claimed_now', p_quest);
end;
$$;

-- The player's level counts quest XP too (same formula as 0037 otherwise).
create or replace function public.player_progress(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with s as (select player_stats(p_user) as j),
  b as (select count(*)::int as n from user_badges where user_id = p_user),
  qx as (select coalesce(sum(xp), 0)::int as n from quest_claims where user_id = p_user),
  x as (
    select (10 * (j ->> 'games')::int + 15 * (j ->> 'wins')::int + 25 * (j ->> 'mvps')::int
            + 5 * (j ->> 'hosted')::int + 2 * (j ->> 'check_ins')::int + 20 * b.n + qx.n) as xp
    from s, b, qx
  ),
  lv as (select xp, floor((1 + sqrt(1 + 0.08 * xp)) / 2)::int as level from x)
  select jsonb_build_object(
    'xp', lv.xp,
    'level', lv.level,
    'level_xp', 50 * lv.level * (lv.level - 1),
    'next_level_xp', 50 * (lv.level + 1) * lv.level,
    'stats', s.j,
    'streak', player_streak(p_user),
    'quest_streak', quest_streak(p_user),
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

-- From 17:00 UTC, once a day: remind players whose streak (2+ days) ends
-- tonight that one quest keeps it.
create or replace function public.quest_tick()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_day date := quest_today();
  v_n int := 0;
begin
  if extract(hour from now() at time zone 'UTC') < 17 then
    return jsonb_build_object('quest_nudges', 0);
  end if;
  insert into progress_runs (key) values ('quest:' || v_day) on conflict do nothing;
  if not found then
    return jsonb_build_object('quest_nudges', 0);
  end if;
  with at_risk as (
    select distinct c.user_id, (quest_streak(c.user_id) ->> 'current')::int as n
    from quest_claims c join users u on u.id = c.user_id and u.suspended_at is null
    where c.day = v_day - 1
      and not exists (select 1 from quest_claims t where t.user_id = c.user_id and t.day = v_day)
  )
  insert into notifications (user_id, type, title, body, data, dedupe_key)
  select a.user_id, 'achievement',
         case when u.locale = 'fr' then 'Votre série de ' || a.n || ' jours' else 'Your ' || a.n || '-day streak' end,
         case when u.locale = 'fr' then 'Terminez une quête du jour avant minuit pour la garder.' else 'Finish one daily quest before midnight to keep it.' end,
         jsonb_build_object('kind', 'quest', 'days', a.n),
         'quest:' || a.user_id || ':' || v_day
  from at_risk a join users u on u.id = a.user_id
  where a.n >= 2
  on conflict (dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return jsonb_build_object('quest_nudges', v_n);
end;
$$;
