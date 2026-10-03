package api

import (
	"log/slog"
	"net/http"
)

// firebaseSignIn exchanges a Firebase Auth ID token (Google provider via the
// Firebase SDK) for a Find the Game session. Account linking matches
// /api/auth/google.
func (s *Server) firebaseSignIn(w http.ResponseWriter, r *http.Request) {
	if !s.firebase.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "firebase_not_configured", "Google sign-in isn't available.")
		return
	}
	var in struct {
		IDToken string `json:"id_token"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.IDToken == "" || len(in.IDToken) > 8192 {
		writeError(w, http.StatusUnprocessableEntity, "invalid_firebase_token", "Google sign-in failed. Try again.")
		return
	}
	id, err := s.firebase.Verify(r.Context(), in.IDToken)
	if err != nil {
		slog.Warn("firebase token rejected", "err", err)
		writeError(w, http.StatusUnauthorized, "invalid_firebase_token", "Google sign-in failed. Try again.")
		return
	}
	s.oauthGoogleIdentity(w, r, id)
}
