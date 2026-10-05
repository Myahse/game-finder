package api

import (
	"net/http"
	"strings"

	"findthegame/backend/internal/avatar"
)

func (s *Server) allowedUploadURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true
	}
	if isAvatarPresetURL(raw) || raw == avatar.ProfileMarkerURL {
		return true
	}
	if s.media != nil {
		return s.media.AllowedStoredURL(raw)
	}
	return strings.HasPrefix(raw, "/uploads/")
}

// canonicalPhotoRef matches stored upload URLs even when hosts differ (R2 vs API proxy).
func canonicalPhotoRef(raw string) string {
	raw = strings.TrimSpace(raw)
	for _, prefix := range []string{"/court/", "/avatar/", "/uploads/"} {
		if i := strings.Index(raw, prefix); i >= 0 {
			return raw[i:]
		}
	}
	return raw
}

func (s *Server) validateUploadURLs(w http.ResponseWriter, urls []string) bool {
	for _, u := range urls {
		if !s.allowedUploadURL(u) {
			writeError(w, http.StatusUnprocessableEntity, "invalid_photo_url", "Photos must be uploaded through the app.")
			return false
		}
	}
	return true
}
