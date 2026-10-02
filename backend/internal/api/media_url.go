package api

import (
	"net/http"
	"strings"
)

func (s *Server) allowedUploadURL(raw string) bool {
	if s.media != nil {
		return s.media.AllowedStoredURL(raw)
	}
	raw = strings.TrimSpace(raw)
	return raw == "" || strings.HasPrefix(raw, "/uploads/")
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
