package api

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"

	"findthegame/backend/internal/auth"
)

// deleteMe permanently deletes the signed-in account: DELETE /api/me.
//
// Google Play and the App Store require apps that let people create an account
// to let them delete it from inside the app (and from the web). Accounts with
// a password must confirm it; Google/Apple-only accounts have none to give.
//
// Everything owned by the user cascades (presence, game seats, friends,
// notifications, tokens, avatar, progression...). Games they organise that are
// still upcoming or live are cancelled first so the other players are told.
// Courts and court photos they contributed stay (community data, creator set
// to null by the schema).
func (s *Server) deleteMe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Password string `json:"password"`
	}
	if r.ContentLength != 0 && !readJSON(w, r, &in) {
		return
	}
	userID := uid(r)

	var hash string
	if err := s.db.Pool.QueryRow(r.Context(),
		`select coalesce(password_hash, '') from users where id = $1`, userID).Scan(&hash); err != nil {
		writeDBError(w, r, err)
		return
	}
	if hash != "" && !auth.CheckPassword(hash, in.Password) {
		writeError(w, http.StatusForbidden, "wrong_password", "Your current password is wrong.")
		return
	}

	err := s.db.Tx(r.Context(), userID, func(tx pgx.Tx) error {
		if _, err := tx.Exec(r.Context(), `
			select public.cancel_game(g.id, 'The organizer deleted their account.')
			from public.games g
			where g.creator_id = $1 and g.status in ('scheduled', 'active')`, userID); err != nil {
			return err
		}
		// The rest runs as the system (like the minute job), not as the user:
		// ON DELETE SET NULL rewrites rows the user doesn't own (e.g. games.creator_id
		// on finished games), and the ownership triggers would refuse that.
		if _, err := tx.Exec(r.Context(), `select set_config('app.user_id', '', true)`); err != nil {
			return err
		}
		tag, err := tx.Exec(r.Context(), `delete from public.users where id = $1`, userID)
		if err == nil && tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return err
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}

	if s.media != nil {
		if err := s.media.DeleteUserAvatars(r.Context(), userID); err != nil {
			slog.Warn("account deleted but avatar files remain", "user_id", userID, "err", err)
		}
	}
	s.clearSessionCookies(w, r)
	w.WriteHeader(http.StatusNoContent)
}
