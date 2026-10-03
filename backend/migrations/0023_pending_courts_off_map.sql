-- Pending courts are hidden from the public map until approved.
-- Notify the proposer when a court enters pending review.

alter type public.notification_type add value if not exists 'court_pending_review';

create or replace function public.court_is_playable(p_status public.court_status)
returns boolean
language sql
immutable
as $$
  select p_status = 'approved';
$$;

create or replace function public.trg_notify_court_approved()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_name text;
  v_notify_players boolean := false;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_notify_players := true;
  elsif tg_op = 'UPDATE' then
    if old.status = new.status then
      return new;
    end if;
    v_notify_players := old.status is distinct from 'approved';
  end if;

  if not v_notify_players then
    return new;
  end if;

  v_name := public.notification_safe_text(new.name, 80);

  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'court_added',
    'New court nearby',
    v_name || ' is now on the map ('
      || round((public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) / 1000)::numeric, 1)
      || ' km away).',
    jsonb_build_object('court_id', new.id),
    'court_added:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.notify_lat is not null
    and p.notify_lng is not null
    and p.suspended_at is null
    and p.role = 'user'
    and p.id is distinct from new.created_by
    and exists (select 1 from public.user_sport_ids(p.id))
    and public.user_matches_court(p.id, new.id)
    and public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) <= v_radius * 1000
    and (
      select count(*) from public.notifications n
      where n.user_id = p.id
        and n.type in ('game_created', 'court_added')
        and n.created_at > now() - interval '1 hour'
    ) < 12
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create or replace function public.trg_notify_creator_court_pending()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_name text;
  v_title text;
  v_body text;
  v_resubmit boolean := false;
begin
  if new.status <> 'pending' or new.created_by is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'pending' then
      return new;
    end if;
    v_resubmit := true;
  end if;

  v_name := public.notification_safe_text(new.name, 80);
  if v_resubmit then
    v_title := 'Court sent for review';
    v_body := '“' || v_name || '” was moved back to review. It is hidden from the map until approved.';
  else
    v_title := 'Court submitted for review';
    v_body := 'We received your proposal for “' || v_name
      || '”. It is hidden from the public map until an admin approves it.';
  end if;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
  values (
    new.created_by,
    'court_pending_review',
    v_title,
    v_body,
    jsonb_build_object('court_id', new.id),
    'court_pending_creator:' || new.id::text,
    true
  )
  on conflict (dedupe_key) do update set
    type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    data = excluded.data,
    push = true,
    read = false,
    created_at = now(),
    pushed_at = null;

  return new;
end;
$$;

drop trigger if exists courts_notify_creator_pending on public.courts;
create trigger courts_notify_creator_pending
  after insert or update of status on public.courts
  for each row execute function public.trg_notify_creator_court_pending();
