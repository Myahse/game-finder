package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"findthegame/backend/internal/avatar"
)

func (s *Server) getMyAvatar(w http.ResponseWriter, r *http.Request) {
	row, ok := s.loadUserAvatar(w, r, uid(r))
	if !ok {
		return
	}
	if row == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"config": nil})
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (s *Server) putMyAvatar(w http.ResponseWriter, r *http.Request) {
	var raw json.RawMessage
	if !readJSON(w, r, &raw) {
		return
	}
	cfg, err := avatar.Parse(raw)
	if err != nil || cfg == nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_avatar", "Invalid avatar configuration.")
		return
	}
	avatar.Normalize(cfg)
	b, err := json.Marshal(cfg)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Could not save avatar.")
		return
	}
	userID := uid(r)
	err = s.db.Exec(r.Context(), userID, `
		insert into user_avatars (user_id, config, use_as_profile, updated_at)
		values ($1, $2::jsonb, $3, now())
		on conflict (user_id) do update set
			config = excluded.config,
			use_as_profile = excluded.use_as_profile,
			updated_at = now()`,
		userID, b, cfg.UseAsProfile)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	var currentURL string
	_ = s.db.Pool.QueryRow(r.Context(), `select coalesce(avatar_url, '') from users where id = $1`, userID).Scan(&currentURL)
	var avatarURL *string
	if cfg.UseAsProfile {
		marker := avatar.ProfileMarkerURL
		avatarURL = &marker
	} else if currentURL == avatar.ProfileMarkerURL || isAvatarPresetURL(currentURL) {
		empty := ""
		avatarURL = &empty
	}
	if avatarURL != nil {
		if err := s.db.Exec(r.Context(), userID, `
		update users set avatar_url = nullif($2, '') where id = $1`,
			userID, avatarURL); err != nil {
			writeDBError(w, r, err)
			return
		}
	}
	row, ok := s.loadUserAvatar(w, r, userID)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, row)
}

func (s *Server) deleteMyAvatar(w http.ResponseWriter, r *http.Request) {
	userID := uid(r)
	if err := s.db.Exec(r.Context(), userID, `delete from user_avatars where user_id = $1`, userID); err != nil {
		writeDBError(w, r, err)
		return
	}
	_ = s.db.Exec(r.Context(), userID, `update users set avatar_url = null where id = $1 and avatar_url = $2`, userID, avatar.ProfileMarkerURL)
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type userAvatarRow struct {
	Config       json.RawMessage `json:"config"`
	UseAsProfile bool            `json:"useAsProfile"`
	UpdatedAt    time.Time       `json:"updatedAt"`
}

func (s *Server) loadUserAvatar(w http.ResponseWriter, r *http.Request, userID string) (*userAvatarRow, bool) {
	var config []byte
	var useAsProfile bool
	var updatedAt time.Time
	err := s.db.Pool.QueryRow(r.Context(), `
		select config, use_as_profile, updated_at from user_avatars where user_id = $1`, userID).Scan(&config, &useAsProfile, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, true
		}
		writeDBError(w, r, err)
		return nil, false
	}
	return &userAvatarRow{Config: config, UseAsProfile: useAsProfile, UpdatedAt: updatedAt}, true
}
