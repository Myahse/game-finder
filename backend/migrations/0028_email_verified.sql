-- Track verified email for password accounts (OAuth sets this on sign-up).

alter table public.users
  add column if not exists email_verified_at timestamptz;

update public.users
set email_verified_at = coalesce(email_verified_at, created_at)
where email_verified_at is null;
