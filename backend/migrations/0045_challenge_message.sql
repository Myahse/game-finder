-- The challenger can change the challenge message after sending it (until the
-- result is in). Empty clears it.

create or replace function public.update_challenge_message(p_id uuid, p_message text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_c challenges;
begin
  if app_uid() is null or not is_active_user() then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select * into v_c from challenges where id = p_id for update;
  if not found then
    raise exception 'challenge_not_found' using errcode = 'P0001';
  end if;
  if v_c.challenger_id <> app_uid() and not is_admin() then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if v_c.status not in ('pending', 'accepted') then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_message, '')) > 140 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  update challenges set message = nullif(trim(p_message), '') where id = p_id
  returning * into v_c;
  return challenge_json(v_c);
end;
$$;
