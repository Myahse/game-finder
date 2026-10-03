-- Email verification tokens for password sign-up (optional Resend).

create table if not exists public.email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_tokens_user_idx
  on public.email_verification_tokens (user_id);

create or replace function public.issue_email_verification(p_user_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_raw text;
  v_hash text;
begin
  delete from public.email_verification_tokens where user_id = p_user_id;
  v_raw := encode(gen_random_bytes(32), 'base64');
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  insert into public.email_verification_tokens (token_hash, user_id, expires_at)
  values (v_hash, p_user_id, now() + interval '48 hours');
  return v_raw;
end;
$$;

create or replace function public.consume_email_verification(p_raw text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_hash text := encode(digest(p_raw, 'sha256'), 'hex');
  v_uid uuid;
begin
  delete from public.email_verification_tokens
  where token_hash = v_hash and expires_at > now()
  returning user_id into v_uid;
  if v_uid is null then
    return null;
  end if;
  update public.users set email_verified_at = now() where id = v_uid;
  return v_uid;
end;
$$;
