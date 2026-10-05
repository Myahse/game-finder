-- Allow username checks while logged in (onboarding) without matching yourself.

create or replace function public.username_available(p_username text, p_exclude_user_id uuid default null)
returns boolean
language sql
stable
set search_path = public
as $$
  select trim(p_username) ~ '^[A-Za-z0-9_.]{3,24}$'
     and not exists (
       select 1 from public.users
       where username = trim(p_username)::citext
         and (p_exclude_user_id is null or id <> p_exclude_user_id)
     );
$$;
