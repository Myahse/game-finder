-- Up to 2 additional sports per user (on top of preferred_sport_id).

create table if not exists public.user_extra_sports (
  user_id uuid not null references public.users (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, sport_id)
);

create index if not exists user_extra_sports_user_id_idx on public.user_extra_sports (user_id);
