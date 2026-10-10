-- Game link preview: how many players are in and how many seats there are,
-- so the landing page can draw the seats. Counts only, no names.
create or replace function public.get_game_share_preview(p_token text)
returns jsonb
language sql
stable
set search_path = public
as $ftg$
  select jsonb_build_object(
    'valid', true,
    'game_id', g.id,
    'status', g.status,
    'start_time', g.start_time,
    'court_name', c.name,
    'sport_name', s.name,
    'sport_slug', s.slug,
    'game_type', g.game_type,
    'max_players', g.max_players,
    'player_count', (
      select count(*)::int from public.game_players gp
      where gp.game_id = g.id and gp.status = 'joined'
    )
  )
  from public.game_share_links l
  join public.games g on g.id = l.game_id
  join public.courts c on c.id = g.court_id
  join public.sports s on s.id = g.sport_id
  where l.token = trim(p_token)
    and g.status in ('scheduled', 'active')
    and public.court_is_playable(c.status);
$ftg$;
