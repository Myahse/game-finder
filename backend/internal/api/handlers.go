package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"findthegame/backend/internal/db"
)

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

func floatParam(r *http.Request, key string) (float64, bool) {
	f, err := strconv.ParseFloat(r.URL.Query().Get(key), 64)
	return f, err == nil
}

// optFloat returns nil when the parameter is absent so SQL gets NULL.
func optFloat(r *http.Request, key string) *float64 {
	if f, ok := floatParam(r, key); ok {
		return &f
	}
	return nil
}

func optString(r *http.Request, key string) *string {
	if v := strings.TrimSpace(r.URL.Query().Get(key)); v != "" && v != "all" {
		return &v
	}
	return nil
}

func radius(r *http.Request) float64 {
	if f, ok := floatParam(r, "radius_km"); ok && f > 0 {
		return min(f, 100)
	}
	return 25
}

func upcomingHours(r *http.Request) int {
	h := 3
	if v := strings.TrimSpace(r.URL.Query().Get("upcoming_hours")); v != "" {
		n, err := strconv.Atoi(v)
		if err == nil && n > 0 {
			h = n
		}
	}
	return min(h, 24*14)
}

func validCoords(lat, lng float64) bool {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// ---------------------------------------------------------------------------
// Sports & courts
// ---------------------------------------------------------------------------

func (s *Server) listSports(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), "", `
		select coalesce(jsonb_agg(sport_json(s) order by s.sort_order), '[]') from sports s`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) courtsNearby(w http.ResponseWriter, r *http.Request) {
	lat, ok1 := floatParam(r, "lat")
	lng, ok2 := floatParam(r, "lng")
	if !ok1 || !ok2 || !validCoords(lat, lng) {
		writeError(w, http.StatusBadRequest, "location_required", "lat and lng are required.")
		return
	}
	if !s.assertBrowseLocation(w, r, lat, lng) {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(court_json(c, $1, $2) order by n.distance_m), '[]')
		from courts_near($1, $2, $3, $4) n join courts c on c.id = n.id`,
		lat, lng, radius(r), optString(r, "sport"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getCourt(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select court_json(c, $2, $3) || jsonb_build_object(
			'games', coalesce((
				select jsonb_agg(game_json(g, $2, $3) order by g.status, g.start_time)
				from games g
				where g.court_id = c.id
				  and (g.status = 'active' or (g.status = 'scheduled' and g.start_time < now() + interval '7 days'))
			), '[]'),
			'my_presence', (
				select jsonb_build_object('started_at', p.started_at, 'expires_at', p.expires_at)
				from court_presence p
				where p.court_id = c.id and p.user_id = app_uid() and p.status = 'active'
			)
		)
		from courts c
		where c.id = $1 and (
			c.status = 'approved'
			or c.created_by = app_uid()
			or is_admin()
		)`,
		chi.URLParam(r, "id"), optFloat(r, "lat"), optFloat(r, "lng"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) addCourtPhotos(w http.ResponseWriter, r *http.Request) {
	courtID := chi.URLParam(r, "id")
	var in struct {
		Photos []string `json:"photos"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if len(in.Photos) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "photos_required", "Choose at least one photo.")
		return
	}
	if !s.validateUploadURLs(w, in.Photos) {
		return
	}
	status, code, msg, err := s.appendCourtPhotos(r.Context(), courtID, uid(r), in.Photos, false)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if status != 0 {
		writeError(w, status, code, msg)
		return
	}
	var photos []string
	if err := s.db.Pool.QueryRow(r.Context(), `select photos from courts where id = $1`, courtID).Scan(&photos); err != nil {
		writeDBError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"photos": photos})
}

func (s *Server) removeCourtPhotos(w http.ResponseWriter, r *http.Request) {
	courtID := chi.URLParam(r, "id")
	var in struct {
		Photos []string `json:"photos"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if len(in.Photos) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "photos_required", "Choose at least one photo to remove.")
		return
	}
	photos, status, code, msg, err := s.removeCourtPhotoURLs(r.Context(), courtID, uid(r), in.Photos)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if status != 0 {
		writeError(w, status, code, msg)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"photos": photos})
}

// removeCourtPhotoURLs drops matching URLs from a court (proposer or admin only).
func (s *Server) removeCourtPhotoURLs(ctx context.Context, courtID, userID string, remove []string) (photos []string, status int, code, msg string, err error) {
	status, code, msg, err = s.courtProposerMayEdit(ctx, courtID, userID)
	if err != nil || status != 0 {
		return nil, status, code, msg, err
	}
	if err := s.db.Pool.QueryRow(ctx, `select photos from courts where id = $1`, courtID).Scan(&photos); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, http.StatusNotFound, "not_found", "Court not found.", nil
		}
		return nil, 0, "", "", err
	}
	removeSet := make(map[string]bool, len(remove))
	for _, u := range remove {
		key := canonicalPhotoRef(u)
		if key != "" {
			removeSet[key] = true
		}
	}
	if len(removeSet) == 0 {
		return nil, http.StatusUnprocessableEntity, "photos_required", "Choose at least one photo to remove.", nil
	}
	next := make([]string, 0, len(photos))
	for _, p := range photos {
		if removeSet[canonicalPhotoRef(p)] {
			continue
		}
		next = append(next, p)
	}
	if len(next) == len(photos) {
		return nil, http.StatusUnprocessableEntity, "photo_not_found", "That photo is not on this court.", nil
	}
	err = s.db.Tx(ctx, userID, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `update courts set photos = $2 where id = $1`, courtID, next)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, http.StatusNotFound, "not_found", "Court not found.", nil
		}
		return nil, 0, "", "", err
	}
	return next, 0, "", "", nil
}

// appendCourtPhotos merges upload URLs onto a court (max 6 total).
// Proposer or admin unless bootstrapFirstPhoto is true and the court has no photos yet (first photo when hosting a game).
func (s *Server) appendCourtPhotos(ctx context.Context, courtID, userID string, newPhotos []string, bootstrapFirstPhoto bool) (status int, code, msg string, err error) {
	if len(newPhotos) == 0 {
		return 0, "", "", nil
	}
	if len(newPhotos) > 6 {
		return http.StatusUnprocessableEntity, "too_many_photos", "Up to 6 photos per request.", nil
	}
	var have int
	if err := s.db.Pool.QueryRow(ctx, `
		select coalesce((
			select count(*)::int from unnest(c.photos) ph where trim(ph) <> ''
		), 0)
		from courts c where c.id = $1`, courtID).Scan(&have); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return http.StatusNotFound, "not_found", "Court not found.", nil
		}
		return 0, "", "", err
	}
	if have+len(newPhotos) > 6 {
		return http.StatusUnprocessableEntity, "too_many_photos", "This court already has the maximum of 6 photos.", nil
	}
	if bootstrapFirstPhoto {
		if have > 0 {
			return http.StatusForbidden, "not_allowed", "You can only add the first court photo when the court has none yet.", nil
		}
		_, err = s.db.Pool.Exec(ctx, `
			update courts set photos = $2::text[]
			where id = $1`, courtID, newPhotos)
		if err != nil {
			return 0, "", "", err
		}
		return 0, "", "", nil
	}
	status, code, msg, err = s.courtProposerMayEdit(ctx, courtID, userID)
	if err != nil {
		return 0, "", "", err
	}
	if status != 0 {
		return status, code, msg, nil
	}
	err = s.db.Tx(ctx, userID, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			update courts set photos = (
				select coalesce(array_agg(x), '{}')
				from (select unnest(array_cat(photos, $2::text[])) as x limit 6) q
			)
			where id = $1`, courtID, newPhotos)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return http.StatusNotFound, "not_found", "Court not found.", nil
		}
		return 0, "", "", err
	}
	return 0, "", "", nil
}

type courtInput struct {
	Name         string   `json:"name"`
	Latitude     float64  `json:"latitude"`
	Longitude    float64  `json:"longitude"`
	Address      *string  `json:"address"`
	Description  *string  `json:"description"`
	Photos       []string `json:"photos"`
	OpeningHours *string  `json:"opening_hours"`
	Lighting     *bool    `json:"lighting"`
	Surface      *string  `json:"surface"`
	SportIDs     []string `json:"sport_ids"`
}

func (in *courtInput) validate(s *Server, w http.ResponseWriter) bool {
	in.Name = strings.TrimSpace(in.Name)
	switch {
	case len(in.Name) < 2 || len(in.Name) > 80:
		writeError(w, http.StatusUnprocessableEntity, "invalid_name", "Give the court a name (2–80 characters).")
	case !validCoords(in.Latitude, in.Longitude) || (in.Latitude == 0 && in.Longitude == 0):
		writeError(w, http.StatusUnprocessableEntity, "invalid_location", "Pick the court's location on the map.")
	case len(in.SportIDs) == 0:
		writeError(w, http.StatusUnprocessableEntity, "sport_required", "Choose at least one sport.")
	case len(in.Photos) > 6:
		writeError(w, http.StatusUnprocessableEntity, "too_many_photos", "Up to 6 photos.")
	default:
		if in.Photos == nil {
			in.Photos = []string{}
		}
		if !s.validateUploadURLs(w, in.Photos) {
			return false
		}
		return true
	}
	return false
}

// insertCourt is shared by user proposals (forced PENDING by a trigger) and
// admin creation (approved).
func (s *Server) insertCourt(w http.ResponseWriter, r *http.Request, in courtInput, status string) {
	var out []byte
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		var id string
		if err := tx.QueryRow(r.Context(), `
			insert into courts (name, latitude, longitude, address, description, photos, opening_hours, lighting, surface, status, created_by)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, app_uid())
			returning id`,
			in.Name, in.Latitude, in.Longitude, in.Address, in.Description, in.Photos,
			in.OpeningHours, in.Lighting, in.Surface, status).Scan(&id); err != nil {
			return err
		}
		if _, err := tx.Exec(r.Context(), `
			insert into court_sports (court_id, sport_id) select $1, unnest($2::uuid[])
			on conflict do nothing`, id, in.SportIDs); err != nil {
			return err
		}
		return tx.QueryRow(r.Context(), "select court_json(c) from courts c where id = $1", id).Scan(&out)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusCreated, out)
}

func (s *Server) proposeCourt(w http.ResponseWriter, r *http.Request) {
	var in courtInput
	if !readJSON(w, r, &in) || !in.validate(s, w) {
		return
	}
	if !s.enforceCourtSportIDs(w, r, in.SportIDs) {
		return
	}
	// Reuse a quiet court pin nearby instead of duplicating the same spot.
	var out []byte
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		var existingID string
		err := tx.QueryRow(r.Context(), `
			select c.id::text
			from courts c
			left join court_live_stats st on st.court_id = c.id
			where public.court_is_playable(c.status)
			  and public.distance_m($1, $2, c.latitude, c.longitude) <= 75
			  and coalesce(st.player_count, 0) = 0
			  and coalesce(st.active_game_count, 0) = 0
			  and coalesce(st.activity, 'inactive') = 'inactive'
			order by public.distance_m($1, $2, c.latitude, c.longitude)
			limit 1`, in.Latitude, in.Longitude).Scan(&existingID)
		if err == nil {
			if _, err := tx.Exec(r.Context(), `
				insert into court_sports (court_id, sport_id)
				select $1, unnest($2::uuid[])
				on conflict do nothing`, existingID, in.SportIDs); err != nil {
				return err
			}
			return tx.QueryRow(r.Context(), `
				select court_json(c) || jsonb_build_object('reused_nearby', true)
				from courts c where c.id = $1`, existingID).Scan(&out)
		}
		if !db.IsNoRows(err) {
			return err
		}
		var id string
		if err := tx.QueryRow(r.Context(), `
			insert into courts (name, latitude, longitude, address, description, photos, opening_hours, lighting, surface, status, created_by)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', app_uid())
			returning id`,
			in.Name, in.Latitude, in.Longitude, in.Address, in.Description, in.Photos,
			in.OpeningHours, in.Lighting, in.Surface).Scan(&id); err != nil {
			return err
		}
		if _, err := tx.Exec(r.Context(), `
			insert into court_sports (court_id, sport_id) select $1, unnest($2::uuid[])
			on conflict do nothing`, id, in.SportIDs); err != nil {
			return err
		}
		return tx.QueryRow(r.Context(), `
			select court_json(c) || jsonb_build_object('reused_nearby', false)
			from courts c where c.id = $1`, id).Scan(&out)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusCreated, out)
}

var reportTypes = map[string]bool{
	"not_exist": true, "wrong_location": true, "closed": true, "wrong_info": true,
	"unsafe": true, "duplicate": true, "other": true,
}

func (s *Server) reportCourt(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Type        string `json:"type"`
		Description string `json:"description"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if !reportTypes[in.Type] {
		writeError(w, http.StatusUnprocessableEntity, "invalid_type", "Choose what's wrong.")
		return
	}
	if len(in.Description) > 1000 {
		writeError(w, http.StatusUnprocessableEntity, "too_long", "Keep it under 1000 characters.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `
		insert into reports (user_id, court_id, type, description)
		select app_uid(), c.id, $2::report_type, nullif(trim($3), '')
		from courts c where c.id = $1 and c.status = 'approved'
		returning jsonb_build_object('id', id, 'status', status)`,
		chi.URLParam(r, "id"), in.Type, in.Description)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusCreated, b)
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

func (s *Server) gamesNearby(w http.ResponseWriter, r *http.Request) {
	lat, ok1 := floatParam(r, "lat")
	lng, ok2 := floatParam(r, "lng")
	if !ok1 || !ok2 || !validCoords(lat, lng) {
		writeError(w, http.StatusBadRequest, "location_required", "lat and lng are required.")
		return
	}
	if !s.assertBrowseLocation(w, r, lat, lng) {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), "select games_nearby($1, $2, $3, $4, $5)",
		lat, lng, radius(r), optString(r, "sport"), upcomingHours(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

var (
	skillLevels = map[string]bool{"beginner": true, "intermediate": true, "advanced": true, "all_levels": true}
	gameTypes   = map[string]bool{"pickup": true, "training": true, "match": true, "tournament": true}
)

func (s *Server) createGame(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CourtID         string     `json:"court_id"`
		SportID         string     `json:"sport_id"`
		StartTime       *time.Time `json:"start_time"`
		MaxPlayers      *int       `json:"max_players"`
		SkillLevel      string     `json:"skill_level"`
		GameType        string     `json:"game_type"`
		DurationMinutes int        `json:"duration_minutes"`
		CourtPhotos     []string   `json:"court_photos"`
		Latitude        *float64   `json:"latitude"`
		Longitude       *float64   `json:"longitude"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.StartTime == nil {
		now := time.Now()
		in.StartTime = &now
	}
	maxPlayers := 10
	if in.MaxPlayers != nil {
		maxPlayers = *in.MaxPlayers
	}
	if in.DurationMinutes == 0 {
		in.DurationMinutes = 120
	}
	if in.SkillLevel == "" {
		in.SkillLevel = "all_levels"
	}
	if in.GameType == "" {
		in.GameType = "pickup"
	}
	if in.CourtPhotos == nil {
		in.CourtPhotos = []string{}
	}
	switch {
	case in.CourtID == "" || in.SportID == "":
		writeError(w, http.StatusUnprocessableEntity, "court_required", "Choose a court and sport.")
		return
	case maxPlayers != 0 && (maxPlayers < 2 || maxPlayers > 50):
		writeError(w, http.StatusUnprocessableEntity, "invalid_max_players", "Max players must be 2–50, or 0 for unlimited.")
		return
	case !skillLevels[in.SkillLevel] || !gameTypes[in.GameType]:
		writeError(w, http.StatusUnprocessableEntity, "invalid_option", "Invalid skill level or game type.")
		return
	case in.DurationMinutes < 15 || in.DurationMinutes > 600:
		writeError(w, http.StatusUnprocessableEntity, "invalid_duration", "Duration must be 15–600 minutes.")
		return
	case len(in.CourtPhotos) > 6:
		writeError(w, http.StatusUnprocessableEntity, "too_many_photos", "Up to 6 photos for the court.")
		return
	}
	if !s.enforcePreferredSport(w, r, in.SportID) {
		return
	}
	if !s.validateUploadURLs(w, in.CourtPhotos) {
		return
	}
	var have int
	if err := s.db.Pool.QueryRow(r.Context(), `
		select coalesce((
			select count(*)::int from unnest(c.photos) ph where trim(ph) <> ''
		), 0)
		from courts c
		where c.id = $1 and c.status in ('approved', 'pending')`, in.CourtID).Scan(&have); err != nil {
		writeDBError(w, r, err)
		return
	}
	// Starting now creates an active game — creator must be at the court.
	if in.StartTime.Before(time.Now().Add(2 * time.Minute)) {
		if err := s.db.Exec(r.Context(), uid(r), "select assert_at_court($1, $2, $3)", in.CourtID, in.Latitude, in.Longitude); err != nil {
			writeDBError(w, r, err)
			return
		}
	}
	if len(in.CourtPhotos) > 0 {
		bootstrap := have == 0
		status, code, msg, err := s.appendCourtPhotos(r.Context(), in.CourtID, uid(r), in.CourtPhotos, bootstrap)
		if err != nil {
			writeDBError(w, r, err)
			return
		}
		if status != 0 {
			writeError(w, status, code, msg)
			return
		}
	}

	var gameID string
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		return tx.QueryRow(r.Context(), `
			insert into games (court_id, sport_id, creator_id, start_time, max_players, skill_level, game_type, duration_minutes)
			values ($1, $2, app_uid(), $3, $4, $5::skill_level, $6::game_type, $7)
			returning id::text`,
			in.CourtID, in.SportID, *in.StartTime, maxPlayers, in.SkillLevel, in.GameType, in.DurationMinutes).Scan(&gameID)
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, gameID, http.StatusCreated)
}

func (s *Server) writeGame(w http.ResponseWriter, r *http.Request, id string, status int) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select game_json(g, $2, $3) || jsonb_build_object(
			'players', coalesce((
				select jsonb_agg(user_public_json(u) || jsonb_build_object('joined_at', gp.joined_at) order by gp.joined_at)
				from game_players gp join users u on u.id = gp.user_id
				where gp.game_id = g.id and gp.status = 'joined'
			), '[]')
		)
		from games g where g.id = $1`,
		id, optFloat(r, "lat"), optFloat(r, "lng"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, status, b)
}

func (s *Server) getGame(w http.ResponseWriter, r *http.Request) {
	s.writeGame(w, r, chi.URLParam(r, "id"), http.StatusOK)
}

func (s *Server) updateGame(w http.ResponseWriter, r *http.Request) {
	var in struct {
		StartTime       *time.Time `json:"start_time"`
		MaxPlayers      *int       `json:"max_players"`
		SkillLevel      *string    `json:"skill_level"`
		GameType        *string    `json:"game_type"`
		DurationMinutes *int       `json:"duration_minutes"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if (in.SkillLevel != nil && !skillLevels[*in.SkillLevel]) || (in.GameType != nil && !gameTypes[*in.GameType]) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_option", "Invalid skill level or game type.")
		return
	}
	if in.MaxPlayers != nil {
		mp := *in.MaxPlayers
		if mp != 0 && (mp < 2 || mp > 50) {
			writeError(w, http.StatusUnprocessableEntity, "invalid_max_players", "Max players must be 2–50, or 0 for unlimited.")
			return
		}
	}
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		tag, err := tx.Exec(r.Context(), `
			update games set
				start_time = coalesce($2, start_time),
				max_players = coalesce($3, max_players),
				skill_level = coalesce($4::skill_level, skill_level),
				game_type = coalesce($5::game_type, game_type),
				duration_minutes = coalesce($6, duration_minutes)
			where id = $1 and (creator_id = app_uid() or is_admin())
			  and status in ('scheduled', 'active')`,
			chi.URLParam(r, "id"), in.StartTime, in.MaxPlayers, in.SkillLevel, in.GameType, in.DurationMinutes)
		if err == nil && tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return err
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, chi.URLParam(r, "id"), http.StatusOK)
}

func (s *Server) joinGame(w http.ResponseWriter, r *http.Request) {
	gameID := chi.URLParam(r, "id")
	var in struct {
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
	}
	if r.ContentLength > 0 {
		if !readJSON(w, r, &in) {
			return
		}
	}
	var sportID string
	if err := s.db.Pool.QueryRow(r.Context(), `select sport_id::text from games where id = $1`, gameID).Scan(&sportID); err != nil {
		writeDBError(w, r, err)
		return
	}
	if !s.enforcePreferredSport(w, r, sportID) {
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select join_game($1, $2, $3)", gameID, in.Latitude, in.Longitude); err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, chi.URLParam(r, "id"), http.StatusOK)
}

func (s *Server) leaveGame(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), "select leave_game($1)", chi.URLParam(r, "id")); err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, chi.URLParam(r, "id"), http.StatusOK)
}

func (s *Server) cancelGame(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Reason string `json:"reason"`
	}
	if r.ContentLength > 0 && !readJSON(w, r, &in) {
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select cancel_game($1, $2)", chi.URLParam(r, "id"), in.Reason); err != nil {
		writeDBError(w, r, err)
		return
	}
	s.writeGame(w, r, chi.URLParam(r, "id"), http.StatusOK)
}

func (s *Server) inviteToGame(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select invite_to_game($1, $2)",
		chi.URLParam(r, "id"), strings.TrimPrefix(strings.TrimSpace(in.Username), "@")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

const presenceJSON = `jsonb_build_object(
	'id', p.id, 'court_id', p.court_id, 'started_at', p.started_at, 'last_seen', p.last_seen,
	'expires_at', p.expires_at, 'status', p.status,
	'court', (select jsonb_build_object('id', c.id, 'name', c.name, 'latitude', c.latitude, 'longitude', c.longitude)
	          from courts c where c.id = p.court_id),
	'warning_minutes', setting_int('presence_warning_minutes', 5)
)`

func (s *Server) markPresent(w http.ResponseWriter, r *http.Request) {
	var in struct {
		CourtID   string   `json:"court_id"`
		Latitude  *float64 `json:"latitude"`
		Longitude *float64 `json:"longitude"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r),
		"select "+presenceJSON+" from mark_present($1, $2, $3) p", in.CourtID, in.Latitude, in.Longitude)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) confirmPresence(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), "select "+presenceJSON+" from confirm_presence() p")
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) endPresence(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r), "select end_presence()"); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) myPresence(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce((select `+presenceJSON+` from court_presence p
		 where p.user_id = app_uid() and p.status = 'active' and p.expires_at > now()), 'null'::jsonb)`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// ---------------------------------------------------------------------------
// Me / users
// ---------------------------------------------------------------------------

func (s *Server) getMe(w http.ResponseWriter, r *http.Request) {
	b, err := s.meJSON(r.Context(), uid(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		FirstName        *string         `json:"first_name"`
		LastName         *string         `json:"last_name"`
		Username         *string         `json:"username"`
		AvatarURL        *string         `json:"avatar_url"`
		AvatarConfig     json.RawMessage `json:"avatar_config"`
		PreferredSportID *string         `json:"preferred_sport_id"`
		ExtraSportIDs    *[]string       `json:"extra_sport_ids"`
		SkillLevel       *string         `json:"skill_level"`
		Onboarded        *bool           `json:"onboarded"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Username != nil && !usernameRe.MatchString(*in.Username) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_username", "Username: 3–24 letters, numbers, _ or .")
		return
	}
	if in.SkillLevel != nil && !skillLevels[*in.SkillLevel] {
		writeError(w, http.StatusUnprocessableEntity, "invalid_option", "Invalid skill level.")
		return
	}
	if in.AvatarURL != nil && !s.allowedUploadURL(*in.AvatarURL) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_photo_url", "Avatar must be uploaded through the app.")
		return
	}
	var avatarConfigJSON []byte
	var avatarURLForDB *string
	if len(in.AvatarConfig) > 0 && string(in.AvatarConfig) != "null" {
		cfg, err := parseAvatarConfigJSON(in.AvatarConfig)
		if err != nil || cfg == nil {
			writeError(w, http.StatusUnprocessableEntity, "invalid_avatar", "Invalid avatar configuration.")
			return
		}
		avatarConfigJSON, err = json.Marshal(cfg)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "server_error", "Could not save avatar.")
			return
		}
		if cfg.UseAsProfile {
			url := cfg.presetURL()
			avatarURLForDB = &url
		} else {
			var current string
			if err := s.db.Pool.QueryRow(r.Context(), `select coalesce(avatar_url, '') from users where id = $1`, uid(r)).Scan(&current); err != nil {
				writeDBError(w, r, err)
				return
			}
			if isAvatarPresetURL(current) {
				empty := ""
				avatarURLForDB = &empty
			}
		}
	}
	if in.PreferredSportID != nil {
		var existing *string
		var role string
		if err := s.db.Pool.QueryRow(r.Context(), `
			select preferred_sport_id::text, role from users where id = $1`, uid(r)).Scan(&existing, &role); err != nil {
			writeDBError(w, r, err)
			return
		}
		newID := strings.TrimSpace(*in.PreferredSportID)
		if role != "admin" && existing != nil && *existing != "" && newID != "" && newID != *existing {
			writeError(w, http.StatusForbidden, "sport_locked", "Your sport was set at signup and can't be changed.")
			return
		}
	}
	avatarURL := in.AvatarURL
	if avatarURLForDB != nil {
		avatarURL = avatarURLForDB
	}
	err := s.db.Exec(r.Context(), uid(r), `
		update users set
			first_name = coalesce(nullif(trim($2), ''), first_name),
			last_name = coalesce(nullif(trim($3), ''), last_name),
			username = coalesce($4, username),
			avatar_url = case when $5::text is null then avatar_url else nullif($5, '') end,
			avatar_config = case when $9::jsonb is null then avatar_config else $9::jsonb end,
			preferred_sport_id = coalesce($6::uuid, preferred_sport_id),
			skill_level = coalesce($7::skill_level, skill_level),
			onboarded_at = case when $8::bool then coalesce(onboarded_at, now()) else onboarded_at end
		where id = $1`,
		uid(r), in.FirstName, in.LastName, in.Username, avatarURL, in.PreferredSportID, in.SkillLevel, in.Onboarded, nullableJSON(avatarConfigJSON))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if in.ExtraSportIDs != nil {
		if err := s.replaceUserExtraSports(w, r, *in.ExtraSportIDs); err != nil {
			return
		}
	}
	s.getMe(w, r)
}

func dedupeSportIDs(ids []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

// replaceUserExtraSports returns false after writing an HTTP error response.
func (s *Server) replaceUserExtraSports(w http.ResponseWriter, r *http.Request, ids []string) error {
	ids = dedupeSportIDs(ids)
	if len(ids) > 2 {
		writeError(w, http.StatusUnprocessableEntity, "too_many_sports", "You can add up to 2 extra sports.")
		return errors.New("too_many_sports")
	}
	var preferred *string
	if err := s.db.Pool.QueryRow(r.Context(), `select preferred_sport_id::text from users where id = $1`, uid(r)).Scan(&preferred); err != nil {
		writeDBError(w, r, err)
		return err
	}
	for _, id := range ids {
		if preferred != nil && *preferred != "" && id == *preferred {
			writeError(w, http.StatusUnprocessableEntity, "invalid_sport", "Extra sports must be different from your main sport.")
			return errors.New("invalid_sport")
		}
		var active bool
		if err := s.db.Pool.QueryRow(r.Context(), `select active from sports where id = $1::uuid`, id).Scan(&active); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				writeError(w, http.StatusUnprocessableEntity, "invalid_sport", "Unknown sport.")
				return err
			}
			writeDBError(w, r, err)
			return err
		}
		if !active {
			writeError(w, http.StatusUnprocessableEntity, "invalid_sport", "That sport is not available yet.")
			return errors.New("invalid_sport")
		}
	}
	if err := s.db.Exec(r.Context(), uid(r), `delete from user_extra_sports where user_id = app_uid()`); err != nil {
		writeDBError(w, r, err)
		return err
	}
	for _, id := range ids {
		if err := s.db.Exec(r.Context(), uid(r), `insert into user_extra_sports (user_id, sport_id) values (app_uid(), $1::uuid)`, id); err != nil {
			writeDBError(w, r, err)
			return err
		}
	}
	return nil
}

func (s *Server) setNotifyArea(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if !validCoords(in.Latitude, in.Longitude) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_location", "Invalid location.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select set_notify_area($1, $2)", in.Latitude, in.Longitude); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) registerPushToken(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Token == "" || len(in.Token) > 4096 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_token", "Invalid push token.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select register_push_token($1, $2)", in.Token, in.Platform); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deletePushToken(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "delete from push_tokens where token = $1 and user_id = app_uid()", in.Token); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) myGames(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select jsonb_build_object(
			'current', coalesce((
				select jsonb_agg(game_json(g, $1, $2) order by g.start_time)
				from games g join game_players gp on gp.game_id = g.id
				where gp.user_id = app_uid() and gp.status = 'joined' and g.status in ('scheduled', 'active')
			), '[]'),
			'past', coalesce((
				select jsonb_agg(j order by (j ->> 'start_time') desc) from (
					select game_json(g, $1, $2) j
					from games g join game_players gp on gp.game_id = g.id
					where gp.user_id = app_uid() and g.status in ('completed', 'cancelled')
					order by g.start_time desc limit 50
				) x
			), '[]')
		)`, optFloat(r, "lat"), optFloat(r, "lng"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select user_public_json(u) || jsonb_build_object('stats', (select row_to_json(ps) from profile_stats(u.id) ps))
		from users u where u.id = $1 and u.suspended_at is null`, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

func (s *Server) listNotifications(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select jsonb_build_object(
			'unread', (select count(*) from notifications where user_id = app_uid() and not read),
			'items', coalesce((
				select jsonb_agg(jsonb_build_object(
					'id', n.id, 'type', n.type, 'title', n.title, 'body', n.body,
					'data', n.data, 'read', n.read, 'created_at', n.created_at
				) order by n.created_at desc)
				from (select * from notifications where user_id = app_uid() order by created_at desc limit 100) n
			), '[]')
		)`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) readNotification(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r),
		"update notifications set read = true where id = $1 and user_id = app_uid()", chi.URLParam(r, "id")); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) readAllNotifications(w http.ResponseWriter, r *http.Request) {
	if err := s.db.Exec(r.Context(), uid(r),
		"update notifications set read = true where user_id = app_uid() and not read"); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// pushTest sends a notification straight to the caller's registered devices
// (nothing is added to their notification list) and reports what happened, so
// players and admins can see why a phone isn't getting alerts.
func (s *Server) pushTest(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Pool.Query(r.Context(), `select token, coalesce(platform, '') from push_tokens where user_id = $1`, uid(r))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	type device struct{ token, platform string }
	var devices []device
	for rows.Next() {
		var d device
		if err := rows.Scan(&d.token, &d.platform); err != nil {
			rows.Close()
			writeDBError(w, r, err)
			return
		}
		devices = append(devices, d)
	}
	rows.Close()

	out := map[string]any{"server_configured": s.push != nil, "devices": len(devices), "delivered": 0, "errors": []string{}}
	if s.push == nil || len(devices) == 0 {
		writeJSON(w, http.StatusOK, out)
		return
	}
	delivered := 0
	errs := []string{}
	for _, d := range devices {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		invalid, err := s.push.Send(ctx, d.token, "Notifications are on 🎉",
			"You'll get game invites, challenges and reminders here.", map[string]string{"type": "system", "test": "1"})
		cancel()
		if invalid {
			_, _ = s.db.Pool.Exec(r.Context(), "delete from push_tokens where token = $1", d.token)
		}
		if err != nil {
			msg := err.Error()
			if len(msg) > 300 {
				msg = msg[:300]
			}
			errs = append(errs, d.platform+": "+msg)
			continue
		}
		delivered++
	}
	out["delivered"] = delivered
	out["errors"] = errs
	writeJSON(w, http.StatusOK, out)
}
