-- A court goes live on the map: its author is told it was approved, and every other active player
-- hears that it was added (not only players nearby who play one of its sports). Texts follow the
-- recipient's language.

CREATE OR REPLACE FUNCTION public.trg_notify_court_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
begin
  if new.status <> 'approved' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_name := public.notification_safe_text(new.name, 80);

  -- The author (unless they approved it themselves).
  if new.created_by is not null and new.created_by is distinct from public.app_uid() then
    insert into public.notifications (user_id, type, title, body, data, dedupe_key)
    select u.id, 'court_added',
      case when u.locale = 'fr' then 'Votre terrain est validé' else 'Your court is approved' end,
      case when u.locale = 'fr' then v_name || ' est maintenant sur la carte. Partagez-le avec votre équipe !'
           else v_name || ' is now on the map. Share it with your crew!' end,
      jsonb_build_object('court_id', new.id, 'kind', 'court_approved'),
      'court_approved:' || new.id::text
    from public.users u
    where u.id = new.created_by and u.suspended_at is null
    on conflict (dedupe_key) do nothing;
  end if;

  -- Everyone else.
  insert into public.notifications (user_id, type, title, body, data, dedupe_key)
  select
    p.id,
    'court_added',
    case when p.locale = 'fr' then 'Nouveau terrain sur la carte' else 'New court on the map' end,
    case when p.locale = 'fr' then 'Le terrain ' || v_name || ' a été ajouté.' else 'The court ' || v_name || ' was added.' end
      || case
           when p.notify_lat is null or p.notify_lng is null then ''
           when public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) > 50000 then ''
           else case when p.locale = 'fr' then ' Il est à ' else ' It is ' end
             || replace(round((public.distance_m(p.notify_lat, p.notify_lng, new.latitude, new.longitude) / 1000)::numeric, 1)::text, '.',
                        case when p.locale = 'fr' then ',' else '.' end)
             || case when p.locale = 'fr' then ' km de vous.' else ' km from you.' end
         end,
    jsonb_build_object('court_id', new.id),
    'court_added:' || new.id::text || ':' || p.id::text
  from public.users p
  where p.suspended_at is null
    and p.id is distinct from public.app_uid()
    and p.id is distinct from new.created_by
    and (
      select count(*) from public.notifications n
      where n.user_id = p.id
        and n.type in ('game_created', 'court_added')
        and n.created_at > now() - interval '1 hour'
    ) < 12
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;
