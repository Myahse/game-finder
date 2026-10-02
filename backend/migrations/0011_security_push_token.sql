-- Prevent hijacking another user's FCM device token on register.

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := app_uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if nullif(trim(p_token), '') is null then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  select user_id into v_owner from public.push_tokens where token = p_token;
  if v_owner is not null and v_owner <> v_uid then
    raise exception 'token_in_use' using errcode = 'P0001';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (v_uid, p_token, nullif(trim(p_platform), ''))
  on conflict (token) do update
    set platform = excluded.platform, updated_at = now();
end;
$$;
