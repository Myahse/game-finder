-- Friends + admin alerts (new user, court proposal) + court alerts on approve only.

alter type public.notification_type add value if not exists 'admin_new_user';
alter type public.notification_type add value if not exists 'admin_court_request';
alter type public.notification_type add value if not exists 'friend_request';
alter type public.notification_type add value if not exists 'friend_accepted';

create type public.friendship_status as enum ('pending', 'accepted', 'declined');

create table if not exists public.friend_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  addressee_id uuid not null references public.users (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_links_distinct check (requester_id <> addressee_id),
  constraint friend_links_pair_unique unique (requester_id, addressee_id)
);

create index if not exists friend_links_addressee_pending_idx
  on public.friend_links (addressee_id) where status = 'pending';

create or replace function public.notify_admins(
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb,
  p_dedupe_base text
)
returns void
language sql
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
  select
    u.id,
    p_type,
    p_title,
    p_body,
    p_data,
    p_dedupe_base || ':' || u.id::text,
    true
  from public.users u
  where u.role = 'admin' and u.suspended_at is null
  on conflict (dedupe_key) do nothing;
$$;

create or replace function public.trg_notify_admins_new_user()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role <> 'admin' then
    perform public.notify_admins(
      'admin_new_user',
      'New player',
      public.notification_safe_text(new.first_name || ' (@' || new.username::text || ')', 120) || ' signed up.',
      jsonb_build_object('user_id', new.id),
      'admin_user:' || new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists users_notify_admins on public.users;
create trigger users_notify_admins
  after insert on public.users
  for each row execute function public.trg_notify_admins_new_user();

create or replace function public.trg_notify_admins_court_pending()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_creator text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select public.notification_safe_text(coalesce(nullif(trim(u.first_name), ''), u.username::text), 40)
  into v_creator
  from public.users u where u.id = new.created_by;

  perform public.notify_admins(
    'admin_court_request',
    'Court to review',
    coalesce(v_creator || ' proposed ', 'New proposal: ')
      || public.notification_safe_text(new.name, 80) || '.',
    jsonb_build_object('court_id', new.id),
    'admin_court_req:' || new.id::text
  );

  return new;
end;
$$;

drop trigger if exists courts_notify_admins_pending on public.courts;
create trigger courts_notify_admins_pending
  after insert on public.courts
  for each row execute function public.trg_notify_admins_court_pending();

-- Players: court_added only when a court is approved (not on pending proposal).
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

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------

create or replace function public.send_friend_request(p_username text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := app_uid();
  v_other uuid;
  v_name text;
  v_link public.friend_links;
  v_reverse public.friend_links;
begin
  if v_me is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select id into v_other from public.users
  where username = trim(p_username)::citext and suspended_at is null;
  if v_other is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  if v_other = v_me then
    raise exception 'invalid_request' using errcode = 'P0001';
  end if;

  select * into v_link from public.friend_links
  where requester_id = v_me and addressee_id = v_other;
  if found and v_link.status = 'accepted' then
    raise exception 'already_friends' using errcode = 'P0001';
  end if;
  if found and v_link.status = 'pending' then
    raise exception 'request_pending' using errcode = 'P0001';
  end if;

  select * into v_reverse from public.friend_links
  where requester_id = v_other and addressee_id = v_me;
  if found and v_reverse.status = 'accepted' then
    raise exception 'already_friends' using errcode = 'P0001';
  end if;
  if found and v_reverse.status = 'pending' then
    update public.friend_links set status = 'accepted', responded_at = now() where id = v_reverse.id;
    insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
    select v_other, 'friend_accepted', 'Friend request accepted',
      public.notification_safe_text(coalesce(nullif(trim(u.first_name), ''), u.username::text), 40)
        || ' accepted your friend request.',
      jsonb_build_object('user_id', v_me),
      'friend_accepted:' || v_reverse.id::text,
      true
    from public.users u where u.id = v_me
    on conflict (dedupe_key) do nothing;
    return jsonb_build_object('status', 'accepted', 'auto', true);
  end if;

  insert into public.friend_links (requester_id, addressee_id, status)
  values (v_me, v_other, 'pending')
  returning * into v_link;

  select public.notification_safe_text(coalesce(nullif(trim(first_name), ''), username::text), 40)
  into v_name from public.users where id = v_me;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
  values (
    v_other,
    'friend_request',
    'Friend request',
    v_name || ' wants to be friends.',
    jsonb_build_object('friend_request_id', v_link.id, 'user_id', v_me),
    'friend_req:' || v_link.id::text,
    true
  )
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('id', v_link.id, 'status', 'pending');
end;
$$;

create or replace function public.respond_friend_request(p_link_id uuid, p_accept boolean)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_me uuid := app_uid();
  v_link public.friend_links;
  v_name text;
begin
  select * into v_link from public.friend_links where id = p_link_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_link.addressee_id <> v_me then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_link.status <> 'pending' then
    return;
  end if;

  if p_accept then
    update public.friend_links set status = 'accepted', responded_at = now() where id = p_link_id;
    select public.notification_safe_text(coalesce(nullif(trim(first_name), ''), username::text), 40)
    into v_name from public.users where id = v_me;
    insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
    values (
      v_link.requester_id,
      'friend_accepted',
      'Friend request accepted',
      v_name || ' accepted your friend request.',
      jsonb_build_object('user_id', v_me),
      'friend_accepted:' || p_link_id::text,
      true
    )
    on conflict (dedupe_key) do nothing;
  else
    update public.friend_links set status = 'declined', responded_at = now() where id = p_link_id;
  end if;
end;
$$;

create or replace function public.list_my_friends()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(
    public.user_public_json(u) order by u.first_name, u.username
  ), '[]'::jsonb)
  from public.friend_links fl
  join public.users u on u.id = (
    case when fl.requester_id = app_uid() then fl.addressee_id else fl.requester_id end
  )
  where fl.status = 'accepted'
    and (fl.requester_id = app_uid() or fl.addressee_id = app_uid());
$$;

create or replace function public.list_friend_requests()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fl.id,
        'user', public.user_public_json(u),
        'created_at', fl.created_at
      ) order by fl.created_at desc)
      from public.friend_links fl
      join public.users u on u.id = fl.requester_id
      where fl.addressee_id = app_uid() and fl.status = 'pending'
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fl.id,
        'user', public.user_public_json(u),
        'created_at', fl.created_at
      ) order by fl.created_at desc)
      from public.friend_links fl
      join public.users u on u.id = fl.addressee_id
      where fl.requester_id = app_uid() and fl.status = 'pending'
    ), '[]'::jsonb)
  );
$$;
