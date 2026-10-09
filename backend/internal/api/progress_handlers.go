package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// afterScoreboard runs the follow-ups of a saved scoreboard: record the game's
// weather (for the rain badge), replay the sport's ratings and award badges.
// Failures are logged; the scoreboard itself is already saved.
func (s *Server) afterScoreboard(ctx context.Context, gameID string) {
	s.recordGameWeather(ctx, gameID)
	if err := s.db.Exec(ctx, "", `select recompute_sport_ratings(sport_id) from games where id = $1`, gameID); err != nil {
		slog.Error("recompute ratings", "game", gameID, "err", err)
	}
	if err := s.db.Exec(ctx, "", `select sync_badges(user_id) from game_players where game_id = $1 and status = 'joined'`, gameID); err != nil {
		slog.Error("sync badges", "game", gameID, "err", err)
	}
}

func (s *Server) recordGameWeather(ctx context.Context, gameID string) {
	b, err := s.db.JSON(ctx, "", `
		select jsonb_build_object('lat', c.latitude, 'lng', c.longitude, 'start', extract(epoch from g.start_time)::bigint,
			'minutes', g.duration_minutes)
		from games g join courts c on c.id = g.court_id
		where g.id = $1 and g.start_time <= now() and not exists (select 1 from game_weather w where w.game_id = g.id)`, gameID)
	if err != nil {
		return // not started, already recorded, or gone
	}
	var g struct {
		Lat, Lng float64
		Start    int64
		Minutes  int64
	}
	if json.Unmarshal(b, &g) != nil {
		return
	}
	wctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	data, err := s.weather.get(wctx, g.Lat, g.Lng)
	if err != nil {
		return
	}
	var f weatherForecast
	if json.Unmarshal(data, &f) != nil || len(f.Hours) == 0 {
		return
	}
	// The wettest forecast hour during the game window counts.
	from := g.Start - g.Start%3600
	to := g.Start + g.Minutes*60
	var best *weatherHour
	for i, h := range f.Hours {
		if h.Time < from || h.Time >= to {
			continue
		}
		if best == nil || h.Rain > best.Rain || (h.Rain == best.Rain && h.Precip > best.Precip) {
			best = &f.Hours[i]
		}
	}
	if best == nil {
		return
	}
	if err := s.db.Exec(ctx, "", `insert into game_weather (game_id, code, rain_pct, precip_mm, temp) values ($1, $2, $3, $4, $5)
		on conflict (game_id) do nothing`, gameID, best.Code, best.Rain, best.Precip, best.Temp); err != nil {
		slog.Error("record game weather", "game", gameID, "err", err)
	}
}

// getMyProgress returns XP, level, ratings, streak, badges and crowns, and
// awards any badge earned since the last check (listed in new_badges).
func (s *Server) getMyProgress(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		with nb as (select sync_badges(app_uid()) as ids)
		select player_progress(app_uid()) || jsonb_build_object('new_badges', to_jsonb(nb.ids)) from nb`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// getUserProgress is another player's public progression.
func (s *Server) getUserProgress(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select player_progress(u.id) from users u where u.id = $1 and u.suspended_at is null`, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// getUserCard is a player's card for one sport (?sport=slug, else their main
// sport). {id} may be "me".
func (s *Server) getUserCard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "me" {
		id = uid(r)
	}
	b, err := s.db.JSON(r.Context(), uid(r), `
		select player_card(u.id, $2) from users u where u.id = $1 and u.suspended_at is null`,
		id, r.URL.Query().Get("sport"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// getKings lists this week's Kings of the Court.
func (s *Server) getKings(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select current_kings()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=300")
	writeRaw(w, http.StatusOK, b)
}
