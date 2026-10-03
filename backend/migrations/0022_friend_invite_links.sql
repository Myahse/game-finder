-- Shareable friend invite links (accept when logged in, or after sign-up).

create table if not exists public.friend_invite_links (
  token text primary key,
  inviter_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create unique index if not exists friend_invite_links_inviter_idx on public.friend_invite_links (inviter_id);

create or replace function public.ensure_friend_invite_link()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select token into v_token
  from public.friend_invite_links
  where inviter_id = v_uid and expires_at > now()
  order by created_at desc
  limit 1;

  if v_token is not null then
    return v_token;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into public.friend_invite_links (token, inviter_id)
  values (v_token, v_uid);
  return v_token;
end;
$$;

create or replace function public.get_friend_invite_preview(p_token text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'valid', true,
    'inviter', public.user_public_json(u),
    'expires_at', l.expires_at
  )
  from public.friend_invite_links l
  join public.users u on u.id = l.inviter_id
  where l.token = trim(p_token)
    and l.expires_at > now()
    and u.suspended_at is null;
$$;

create or replace function public.accept_friend_invite_for_user(p_token text, p_user_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_inviter uuid;
  v_name text;
begin
  if p_user_id is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select l.inviter_id into v_inviter
  from public.friend_invite_links l
  join public.users u on u.id = l.inviter_id
  where l.token = trim(p_token)
    and l.expires_at > now()
    and u.suspended_at is null;

  if v_inviter is null then
    raise exception 'invite_not_found' using errcode = 'P0001';
  end if;

  if v_inviter = p_user_id then
    raise exception 'invalid_request' using errcode = 'P0001';
  end if;

  insert into public.friend_links (requester_id, addressee_id, status, responded_at)
  values (v_inviter, p_user_id, 'accepted', now())
  on conflict (requester_id, addressee_id) do update set
    status = 'accepted',
    responded_at = coalesce(friend_links.responded_at, now())
  where friend_links.status <> 'accepted';

  select public.notification_safe_text(coalesce(nullif(trim(first_name), ''), username::text), 40)
  into v_name from public.users where id = p_user_id;

  insert into public.notifications (user_id, type, title, body, data, dedupe_key, push)
  values (
    v_inviter,
    'friend_accepted',
    'Friend link accepted',
    v_name || ' joined via your invite link.',
    jsonb_build_object('user_id', p_user_id),
    'friend_link:' || p_token || ':' || p_user_id::text,
    true
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.accept_friend_invite_link(p_token text)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.accept_friend_invite_for_user(p_token, app_uid());
end;
$$;
