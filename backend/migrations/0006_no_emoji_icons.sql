-- Sports.icon is legacy API metadata; clients render icons from slug.
UPDATE public.sports SET icon = name;

-- Stop prefixing notification bodies with emoji sport icons.
CREATE OR REPLACE FUNCTION public.tick()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_started int;
  v_completed int;
  v_expired int;
  v_warned int;
  v_reminded int;
  v_alerts int;
  v_warn int := public.setting_int('presence_warning_minutes', 5);
  v_remind int := public.setting_int('game_reminder_minutes', 30);
  v_radius int := public.setting_int('activity_alert_radius_km', 3);
  v_cooldown int := public.setting_int('activity_alert_cooldown_min', 120);
BEGIN
  UPDATE public.games SET status = 'active'
  WHERE status = 'scheduled' AND start_time <= now();
  GET DIAGNOSTICS v_started = ROW_COUNT;

  UPDATE public.games SET status = 'completed'
  WHERE status = 'active' AND start_time + make_interval(mins => duration_minutes) <= now();
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  UPDATE public.court_presence SET status = 'expired', ended_at = now()
  WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  WITH due AS (
    UPDATE public.court_presence p SET warned_at = now()
    WHERE p.status = 'active' AND p.warned_at IS NULL
      AND p.expires_at - make_interval(mins => v_warn) <= now()
    RETURNING p.id, p.user_id, p.court_id, p.expires_at
  )
  INSERT INTO public.notifications (user_id, type, title, body, data, push, dedupe_key)
  SELECT d.user_id, 'presence_check', 'Are you still playing?',
         'Are you still playing at ' || c.name || '?',
         jsonb_build_object('court_id', d.court_id, 'presence_id', d.id),
         false, 'presence:' || d.id || ':' || extract(epoch FROM d.expires_at)::bigint
  FROM due d JOIN public.courts c ON c.id = d.court_id
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_warned = ROW_COUNT;

  WITH due AS (
    UPDATE public.game_players gp SET reminded_at = now()
    FROM public.games g
    WHERE g.id = gp.game_id AND gp.status = 'joined' AND gp.reminded_at IS NULL
      AND g.status = 'scheduled'
      AND g.start_time > now()
      AND g.start_time <= now() + make_interval(mins => v_remind)
    RETURNING gp.user_id, g.id AS game_id, g.court_id, g.sport_id, g.start_time
  )
  INSERT INTO public.notifications (user_id, type, title, body, data, dedupe_key)
  SELECT d.user_id, 'game_reminder', 'Game reminder',
         s.name || ' game at ' || c.name || ' starts in ' ||
           greatest(1, ceil(extract(epoch FROM d.start_time - now()) / 60))::int || ' minutes.',
         jsonb_build_object('game_id', d.game_id, 'court_id', d.court_id),
         'reminder:' || d.game_id || ':' || d.user_id
  FROM due d
  JOIN public.courts c ON c.id = d.court_id
  JOIN public.sports s ON s.id = d.sport_id
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_reminded = ROW_COUNT;

  WITH newly_active AS (
    UPDATE public.court_live_stats st SET announced_at = now()
    WHERE st.activity = 'active'
      AND st.became_active_at IS NOT NULL
      AND (st.announced_at IS NULL OR st.announced_at < st.became_active_at)
    RETURNING st.court_id
  )
  INSERT INTO public.notifications (user_id, type, title, body, data, dedupe_key)
  SELECT p.id, 'game_activity', 'Game on nearby',
         'A game is active ' ||
           round((public.distance_m(p.notify_lat, p.notify_lng, c.latitude, c.longitude) / 1000)::numeric, 1)
           || ' km from you at ' || c.name || '.',
         jsonb_build_object('court_id', c.id),
         'activity:' || c.id || ':' || p.id || ':' ||
           (extract(epoch FROM now())::bigint / (v_cooldown * 60))
  FROM newly_active na
  JOIN public.courts c ON c.id = na.court_id
  JOIN public.users p ON p.notify_lat IS NOT NULL AND p.suspended_at IS NULL
  WHERE public.distance_m(p.notify_lat, p.notify_lng, c.latitude, c.longitude) <= v_radius * 1000
    AND NOT EXISTS (
      SELECT 1 FROM public.court_presence cp
      WHERE cp.user_id = p.id AND cp.court_id = c.id AND cp.status = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.game_players gp JOIN public.games g ON g.id = gp.game_id
      WHERE gp.user_id = p.id AND g.court_id = c.id AND g.status = 'active' AND gp.status = 'joined'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p.id AND n.type = 'game_activity'
        AND n.data ->> 'court_id' = c.id::text
        AND n.created_at > now() - make_interval(mins => v_cooldown)
    )
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_alerts = ROW_COUNT;

  RETURN jsonb_build_object(
    'games_started', v_started, 'games_completed', v_completed,
    'presence_expired', v_expired, 'presence_warned', v_warned,
    'reminders', v_reminded, 'activity_alerts', v_alerts
  );
END;
$$;
