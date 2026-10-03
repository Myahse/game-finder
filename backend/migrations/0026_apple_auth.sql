-- Sign in with Apple (Firebase Auth), same linking model as Google.

alter table public.users add column if not exists apple_sub text;
create unique index if not exists users_apple_sub_idx on public.users (apple_sub) where apple_sub is not null;
