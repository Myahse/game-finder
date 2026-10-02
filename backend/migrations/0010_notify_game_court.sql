-- Notify nearby users when a new game is created or a court is added.

alter type public.notification_type add value if not exists 'game_created';
alter type public.notification_type add value if not exists 'court_added';

create or replace function public.trg_notify_game_created()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_court public.courts;
  v_sport text;
  v_creator text;
begin
  select * into v_court from public.courts where id = new.court_id;
  if not found then
    return null;
  end if;

  select lower(s.name) into v_sport from public.sports s where s.id = new.sport_id;

  if new.creator_id is not null then
    select coalesce(nullif(trim(first_name), ''), username::text)
    into v_creator
    from public.users where id = new.creator_id;
  end if;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'game_created',
    'New game nearby',
    coalesce(v_creator || ' started a ', 'New ') || coalesce(v_sport, 'pickup') || ' game at ' || v_court.name
      || ' (' || round((public.distance_m(p.notify_lat, p.notify_lng, v_court.latitude, v_court.longitude) / 1000)::numeric, 1) || ' km).',
    jsonb_build_object('game_id', new.id, 'court_id', new.court_id),
    'game_created:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.id is distinct from new.creator_id
    and public.distance_m(p.notify_lat, p.notify_lng, v_court.latitude, v_court.longitude) <= v_radius * 1000
  on conflict (dedupe_key) do nothing;

  return null;
end;
$$;

drop trigger if exists games_notify_created on public.games;
create trigger games_notify_created
  after insert on public.games
  for each row execute function public.trg_notify_game_created();

create or replace function public.trg_notify_court_added()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
begin
  if new.status = 'rejected' then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'court_added',
    'New court nearby',
    '“' || new.name || '” was added '
      || round((public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) / 1000)::numeric, 1)
      || ' km from you.',
    jsonb_build_object('court_id', new.id),
    'court_added:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.id is distinct from new.created_by
    and public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) <= v_radius * 1000
  on conflict (dedupe_key) do nothing;

  return null;
end;
$$;

drop trigger if exists courts_notify_added on public.courts;
create trigger courts_notify_added
  after insert on public.courts
  for each row execute function public.trg_notify_court_added();
