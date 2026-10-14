package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Announcements: admins post a flyer; users see the newest unseen one as a modal and get a notification.

// getPendingAnnouncement returns the newest announcement this user hasn't seen, or null.
func (s *Server) getPendingAnnouncement(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select coalesce(pending_announcement(), 'null'::jsonb)`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) getAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidRe.MatchString(id) {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	b, err := s.db.JSON(r.Context(), uid(r), `select get_announcement($1)`, id)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	if string(b) == "null" || len(b) == 0 {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) markAnnouncementSeen(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidRe.MatchString(id) {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), `select mark_announcement_seen($1)`, id); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminAnnouncements(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `select admin_announcements()`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminCreateAnnouncement(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title    string `json:"title"`
		Body     string `json:"body"`
		ImageURL string `json:"image_url"`
		LinkURL  string `json:"link_url"`
		CTALabel string `json:"cta_label"`
		Notify   *bool  `json:"notify"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Title) == "" {
		writeError(w, http.StatusUnprocessableEntity, "title_required", "Add a title.")
		return
	}
	if !s.validateUploadURLs(w, []string{in.ImageURL}) {
		return
	}
	link := strings.TrimSpace(in.LinkURL)
	if link != "" && !(strings.HasPrefix(link, "https://") || (strings.HasPrefix(link, "/") && !strings.HasPrefix(link, "//"))) {
		writeError(w, http.StatusUnprocessableEntity, "invalid_link", "The button link must be an app path (/play) or an https:// link.")
		return
	}
	notify := in.Notify == nil || *in.Notify
	b, err := s.db.JSON(r.Context(), uid(r), `select admin_create_announcement($1, $2, $3, $4, $5, $6)`,
		in.Title, in.Body, in.ImageURL, link, in.CTALabel, notify)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusCreated, b)
}

func (s *Server) adminUpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !uuidRe.MatchString(id) {
		writeError(w, http.StatusNotFound, "not_found", "Not found.")
		return
	}
	var in struct {
		Active bool `json:"active"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), `select admin_set_announcement_active($1, $2)`, id, in.Active); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
