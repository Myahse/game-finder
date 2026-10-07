-- Undo 0049: only the first-visit tutorial drops emoji; notifications keep theirs.
drop trigger if exists notifications_strip_emoji on public.notifications;
drop function if exists public.trg_notification_no_emoji();
