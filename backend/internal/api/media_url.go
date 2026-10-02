package api

import (
	"net/http"
	"net/url"
	"strings"
)

// Stored photo/avatar URLs must point at this API's upload store (no arbitrary hosts).
func allowedUploadURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true
	}
	if strings.Contains(raw, "..") {
		return false
	}
	if strings.HasPrefix(raw, "/uploads/") {
		return true
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return strings.HasPrefix(u.Path, "/uploads/") && u.Scheme != "javascript"
}

func validateUploadURLs(w http.ResponseWriter, urls []string) bool {
	for _, u := range urls {
		if !allowedUploadURL(u) {
			writeError(w, http.StatusUnprocessableEntity, "invalid_photo_url", "Photos must be uploaded through the app.")
			return false
		}
	}
	return true
}
