-- Admin user list: preferred sport + registered push devices.
drop function if exists public.admin_list_users(text, int);

create function public.admin_list_users(p_search text default null, p_limit int default 50)
returns table (
  id uuid,
  first_name text,
  last_name text,
  username text,
  email text,
  avatar_url text,
  role public.user_role,
  suspended_at timestamptz,
  created_at timestamptz,
  preferred_sport_id uuid,
  preferred_sport_name text,
  preferred_sport_slug text,
  push_device_count int
)
language plpgsql
stable
set search_path = public
as $$
begin
  perform public.assert_admin();
  return query
  select
    p.id,
    p.first_name,
    p.last_name,
    p.username::text,
    p.email::text,
    p.avatar_url,
    p.role,
    p.suspended_at,
    p.created_at,
    p.preferred_sport_id,
    s.name,
    s.slug,
    coalesce((
      select count(*)::int from public.push_tokens pt where pt.user_id = p.id
    ), 0)
  from public.users p
  left join public.sports s on s.id = p.preferred_sport_id
  where p_search is null or p_search = ''
     or p.username ilike '%' || p_search || '%'
     or p.email ilike '%' || p_search || '%'
     or (p.first_name || ' ' || p.last_name) ilike '%' || p_search || '%'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;
