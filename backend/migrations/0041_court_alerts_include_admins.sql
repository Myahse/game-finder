-- 'New court nearby' alerts: include admins too (only the admin who approved is skipped).

CREATE OR REPLACE FUNCTION public.trg_notify_court_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    and p.id is distinct from public.app_uid()
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
$function$

;
