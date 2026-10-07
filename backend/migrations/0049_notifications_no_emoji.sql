-- No emoji in notifications (push and in-app): the apps show proper icons per
-- notification type. Templates still contain emoji (and the French translation
-- matches on them), so strip them as the row is saved — this trigger runs after
-- notifications_localize (BEFORE triggers fire in name order).

create or replace function public.strip_emoji(p text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(
    regexp_replace(p, '[\U0001F000-\U0001FAFF☀-➿⬀-⯿️‍⃣]', '', 'g'),
    '\s{2,}', ' ', 'g')), '');
$$;

create or replace function public.trg_notification_no_emoji()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.title := coalesce(strip_emoji(new.title), new.title);
  new.body := coalesce(strip_emoji(new.body), new.body);
  return new;
end;
$$;

drop trigger if exists notifications_strip_emoji on public.notifications;
create trigger notifications_strip_emoji
  before insert on public.notifications
  for each row execute function public.trg_notification_no_emoji();

update public.notifications
set title = coalesce(strip_emoji(title), title), body = coalesce(strip_emoji(body), body)
where title ~ '[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]'
   or body ~ '[\U0001F000-\U0001FAFF☀-➿⬀-⯿️]';
