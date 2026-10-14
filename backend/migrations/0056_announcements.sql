-- Announcements: an admin posts a flyer (image + title + text + optional button). Every active user gets a
-- notification (pushed to phones that allow it), and the newest unseen announcement opens as a modal
-- the next time they use the app.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 1000),
  image_url text check (image_url is null or char_length(image_url) <= 500),
  -- an in-app path ("/play") or an https link
  link_url text check (link_url is null or link_url ~ '^(/[A-Za-z0-9]|https://)' and char_length(link_url) <= 500),
  cta_label text check (cta_label is null or char_length(btrim(cta_label)) between 1 and 40),
  active boolean not null default true,
  notified integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index announcements_recent_idx on public.announcements (created_at desc) where active;

create table public.announcement_views (
  user_id uuid not null references public.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_views enable row level security;

create or replace function public.announcement_json(a public.announcements)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'image_url', a.image_url,
    'link_url', a.link_url, 'cta_label', a.cta_label, 'active', a.active, 'created_at', a.created_at)
$$;

-- Post an announcement; with p_notify, every active (not suspended) user gets a notification.
create or replace function public.admin_create_announcement(p_title text, p_body text, p_image text, p_link text, p_cta text, p_notify boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a announcements;
  v_n int := 0;
begin
  perform assert_admin();
  insert into announcements (title, body, image_url, link_url, cta_label, created_by)
  values (btrim(p_title), coalesce(btrim(p_body), ''), nullif(btrim(p_image), ''), nullif(btrim(p_link), ''), nullif(btrim(p_cta), ''), app_uid())
  returning * into a;
  if p_notify then
    insert into notifications (user_id, type, title, body, data, dedupe_key)
    select u.id, 'system', a.title,
           case when char_length(a.body) > 180 then left(a.body, 177) || '…' else a.body end,
           jsonb_build_object('kind', 'announcement', 'announcement_id', a.id),
           'announcement:' || a.id || ':' || u.id
    from users u
    where u.suspended_at is null
    on conflict (dedupe_key) do nothing;
    get diagnostics v_n = row_count;
    update announcements set notified = v_n where id = a.id returning * into a;
  end if;
  return announcement_json(a) || jsonb_build_object('notified', v_n, 'seen', 0);
end;
$$;

create or replace function public.admin_announcements()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return coalesce((
    select jsonb_agg(announcement_json(a) || jsonb_build_object('notified', a.notified,
             'seen', (select count(*) from announcement_views v where v.announcement_id = a.id))
           order by a.created_at desc)
    from (select * from announcements order by created_at desc limit 50) a), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_announcement_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin();
  update announcements set active = p_active where id = p_id;
  if not found then
    raise exception 'announcement_not_found';
  end if;
end;
$$;

-- The newest active announcement (last 30 days) the user hasn't seen yet, or null.
create or replace function public.pending_announcement()
returns jsonb language sql stable security definer set search_path = public as $$
  select announcement_json(a)
  from announcements a
  where a.active and a.created_at > now() - interval '30 days'
    and not exists (select 1 from announcement_views v where v.announcement_id = a.id and v.user_id = app_uid())
  order by a.created_at desc
  limit 1
$$;

create or replace function public.mark_announcement_seen(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from announcements where id = p_id) then
    raise exception 'announcement_not_found';
  end if;
  insert into announcement_views (user_id, announcement_id) values (app_uid(), p_id) on conflict do nothing;
  -- the matching notification counts as read too
  update notifications set read = true
  where user_id = app_uid() and dedupe_key = 'announcement:' || p_id || ':' || app_uid();
end;
$$;

-- Opening one from the list (Alerts) shows it again, seen or not.
create or replace function public.get_announcement(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select announcement_json(a) from announcements a where a.id = p_id and (a.active or is_admin())
$$;
