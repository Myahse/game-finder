-- Modular sports-player avatar (renderer-independent JSON config).

create table if not exists public.user_avatars (
  user_id uuid primary key references public.users (id) on delete cascade,
  config jsonb not null,
  use_as_profile boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_avatars_updated_at_idx on public.user_avatars (updated_at desc);

insert into public.user_avatars (user_id, config, use_as_profile)
select
  u.id,
  u.avatar_config,
  coalesce((u.avatar_config->>'use_as_profile')::boolean, true)
from public.users u
where u.avatar_config is not null
  and u.avatar_config::text <> 'null'
on conflict (user_id) do nothing;

create or replace function public.user_public_json(u public.users)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
    'username', u.username, 'avatar_url', u.avatar_url,
    'avatar_config', u.avatar_config,
    'player_avatar', (select ua.config from public.user_avatars ua where ua.user_id = u.id),
    'player_avatar_public',
      (select ua.config from public.user_avatars ua where ua.user_id = u.id and ua.use_as_profile),
    'preferred_sport_id', u.preferred_sport_id, 'skill_level', u.skill_level,
    'created_at', u.created_at
  );
$$;
