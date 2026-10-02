-- Wipe all courts/places so the map starts empty. New spots come from user submissions only.
-- Disable stats triggers so cascading game deletes don't re-insert court_live_stats rows.
alter table public.games disable trigger user;
alter table public.game_players disable trigger user;
alter table public.court_presence disable trigger user;

delete from public.courts;

alter table public.court_presence enable trigger user;
alter table public.game_players enable trigger user;
alter table public.games enable trigger user;
