-- Find the Game — realtime fan-out
-- Changes are published on the `ftg_events` channel with LISTEN/NOTIFY.
-- The Go API listens and forwards them to WebSocket clients.
-- Payloads only ever contain aggregate / public data: never presence rows.

create or replace function public.notify_event(p_payload jsonb)
returns void
language sql
as $$
  select pg_notify('ftg_events', p_payload::text);
$$;

create or replace function public.trg_emit_court_stats()
returns trigger
language plpgsql
as $$
begin
  perform public.notify_event(jsonb_build_object(
    'type', 'court_stats',
    'court_id', new.court_id,
    'player_count', new.player_count,
    'active_game_count', new.active_game_count,
    'activity', new.activity,
    'last_activity_at', new.last_activity_at
  ));
  return null;
end;
$$;

create trigger court_live_stats_emit
  after insert or update on public.court_live_stats
  for each row execute function public.trg_emit_court_stats();

create or replace function public.emit_game(p_game_id uuid, p_kind text)
returns void
language plpgsql
as $$
declare
  g public.games;
  n int;
begin
  select * into g from public.games where id = p_game_id;
  if not found then
    return;
  end if;
  select count(*) into n from public.game_players where game_id = p_game_id and status = 'joined';
  perform public.notify_event(jsonb_build_object(
    'type', 'game',
    'kind', p_kind,
    'game_id', g.id,
    'court_id', g.court_id,
    'sport_id', g.sport_id,
    'status', g.status,
    'player_count', n,
    'max_players', g.max_players,
    'start_time', g.start_time
  ));
end;
$$;

create or replace function public.trg_emit_game()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.notify_event(jsonb_build_object(
      'type', 'game', 'kind', 'deleted', 'game_id', old.id, 'court_id', old.court_id
    ));
  else
    perform public.emit_game(new.id, lower(tg_op));
  end if;
  return null;
end;
$$;

create trigger games_emit
  after insert or update or delete on public.games
  for each row execute function public.trg_emit_game();

create or replace function public.trg_emit_game_player()
returns trigger
language plpgsql
as $$
begin
  perform public.emit_game(coalesce(new.game_id, old.game_id), 'players');
  return null;
end;
$$;

create trigger game_players_emit
  after insert or update or delete on public.game_players
  for each row execute function public.trg_emit_game_player();

create or replace function public.trg_emit_notification()
returns trigger
language plpgsql
as $$
begin
  perform public.notify_event(jsonb_build_object(
    'type', 'notification',
    'user_id', new.user_id,
    'id', new.id,
    'notification_type', new.type,
    'title', new.title,
    'body', new.body,
    'data', new.data
  ));
  return null;
end;
$$;

create trigger notifications_emit
  after insert on public.notifications
  for each row execute function public.trg_emit_notification();
