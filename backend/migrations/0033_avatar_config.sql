-- Player avatar builder (full-body config + optional profile display).

alter table public.users
  add column if not exists avatar_config jsonb;

create or replace function public.user_public_json(u public.users)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
    'username', u.username, 'avatar_url', u.avatar_url,
    'avatar_config', u.avatar_config,
    'preferred_sport_id', u.preferred_sport_id, 'skill_level', u.skill_level,
    'created_at', u.created_at
  );
$$;
