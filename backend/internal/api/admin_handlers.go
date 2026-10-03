package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

func (s *Server) adminStats(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), "select admin_stats()")
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminCourts(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(court_json(c) || jsonb_build_object(
			'creator', (select user_public_json(u) from users u where u.id = c.created_by),
			'open_reports', (select count(*) from reports rp where rp.court_id = c.id and rp.status = 'open')
		) order by c.status = 'pending' desc, c.created_at desc), '[]')
		from (
			select * from courts
			where ($1::court_status is null or status = $1::court_status)
			  and ($2::text is null or name ilike '%' || $2 || '%' or address ilike '%' || $2 || '%')
			order by created_at desc limit 300
		) c`, optString(r, "status"), optString(r, "q"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminGetCourt(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	b, err := s.db.JSON(r.Context(), uid(r), `
		select court_json(c, $2, $3) || jsonb_build_object(
			'creator', (select user_public_json(u) from users u where u.id = c.created_by),
			'open_reports', (select count(*) from reports rp where rp.court_id = c.id and rp.status = 'open'),
			'games', coalesce((
				select jsonb_agg(game_json(g, $2, $3) order by g.status, g.start_time)
				from games g
				where g.court_id = c.id
				  and (g.status = 'active' or (g.status = 'scheduled' and g.start_time < now() + interval '7 days'))
			), '[]')
		)
		from courts c where c.id = $1`,
		id, optFloat(r, "lat"), optFloat(r, "lng"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminCreateCourt(w http.ResponseWriter, r *http.Request) {
	var in courtInput
	if !readJSON(w, r, &in) || !in.validate(s, w) {
		return
	}
	s.insertCourt(w, r, in, "approved")
}

func (s *Server) adminUpdateCourt(w http.ResponseWriter, r *http.Request) {
	var in courtInput
	if !readJSON(w, r, &in) || !in.validate(s, w) {
		return
	}
	id := chi.URLParam(r, "id")
	var out []byte
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		tag, err := tx.Exec(r.Context(), `
			update courts set name = $2, latitude = $3, longitude = $4, address = $5, description = $6,
				photos = $7, opening_hours = $8, lighting = $9, surface = $10
			where id = $1`,
			id, in.Name, in.Latitude, in.Longitude, in.Address, in.Description, in.Photos,
			in.OpeningHours, in.Lighting, in.Surface)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		if _, err := tx.Exec(r.Context(), "delete from court_sports where court_id = $1 and sport_id <> all($2::uuid[])", id, in.SportIDs); err != nil {
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
	writeRaw(w, http.StatusOK, out)
}

func (s *Server) adminReviewCourt(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Approve *bool  `json:"approve"`
		Pending bool   `json:"pending"`
		Reason  string `json:"reason"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Pending {
		if err := s.db.Exec(r.Context(), uid(r), "select admin_review_court($1, false, null, true)",
			chi.URLParam(r, "id")); err != nil {
			writeDBError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if in.Approve == nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Send approve or pending.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select admin_review_court($1, $2, $3, false)",
		chi.URLParam(r, "id"), *in.Approve, in.Reason); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminDeleteCourt(w http.ResponseWriter, r *http.Request) {
	s.adminDelete(w, r, "delete from courts where id = $1")
}

func (s *Server) adminGames(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(game_json(g) order by g.start_time desc), '[]')
		from (
			select * from games
			where ($1::game_status is null or status = $1::game_status)
			order by start_time desc limit 300
		) g`, optString(r, "status"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminDeleteGame(w http.ResponseWriter, r *http.Request) {
	s.adminDelete(w, r, "delete from games where id = $1")
}

func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(to_jsonb(u) || jsonb_build_object(
			'stats', (select row_to_json(ps) from profile_stats(u.id) ps)
		)), '[]') from admin_list_users($1, 100) u`, r.URL.Query().Get("q"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminSuspendUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Suspended bool `json:"suspended"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		if _, err := tx.Exec(r.Context(), "select admin_set_suspended($1, $2)", chi.URLParam(r, "id"), in.Suspended); err != nil {
			return err
		}
		if in.Suspended { // sign them out everywhere
			_, err := tx.Exec(r.Context(), "update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null", chi.URLParam(r, "id"))
			return err
		}
		return nil
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminDeleteUser(w http.ResponseWriter, r *http.Request) {
	if chi.URLParam(r, "id") == uid(r) {
		writeError(w, http.StatusUnprocessableEntity, "cannot_delete_self", "You can't delete your own account here.")
		return
	}
	s.adminDelete(w, r, "delete from users where id = $1")
}

func (s *Server) adminReports(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', rp.id, 'type', rp.type, 'description', rp.description, 'status', rp.status,
			'admin_note', rp.admin_note, 'created_at', rp.created_at, 'resolved_at', rp.resolved_at,
			'court', (select jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status) from courts c where c.id = rp.court_id),
			'reporter', (select user_public_json(u) from users u where u.id = rp.user_id)
		) order by rp.created_at desc), '[]')
		from (
			select * from reports
			where ($1::report_status is null or status = $1::report_status)
			order by created_at desc limit 300
		) rp`, optString(r, "status"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminResolveReport(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Status != "resolved" && in.Status != "rejected" && in.Status != "open" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_status", "Status must be resolved, rejected or open.")
		return
	}
	if err := s.db.Exec(r.Context(), uid(r), "select admin_resolve_report($1, $2::report_status, $3)",
		chi.URLParam(r, "id"), in.Status, in.Note); err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) adminSettings(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r), `
		select coalesce(jsonb_agg(jsonb_build_object('key', key, 'value', value, 'description', description) order by key), '[]')
		from app_settings`)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	writeRaw(w, http.StatusOK, b)
}

func (s *Server) adminUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var in map[string]json.RawMessage
	if !readJSON(w, r, &in) {
		return
	}
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		for k, v := range in {
			tag, err := tx.Exec(r.Context(), "update app_settings set value = $2::jsonb, updated_at = now() where key = $1", k, string(v))
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 0 {
				return pgx.ErrNoRows
			}
		}
		return nil
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	s.adminSettings(w, r)
}

func (s *Server) adminDelete(w http.ResponseWriter, r *http.Request, query string) {
	err := s.db.Tx(r.Context(), uid(r), func(tx pgx.Tx) error {
		tag, err := tx.Exec(r.Context(), query, chi.URLParam(r, "id"))
		if err == nil && tag.RowsAffected() == 0 {
			return pgx.ErrNoRows
		}
		return err
	})
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Uploads (avatars, court photos). Stored on local disk under UPLOAD_DIR;
// swap for object storage by replacing this handler.
// ---------------------------------------------------------------------------

var imageExt = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes+1024)
	if err := r.ParseMultipartForm(s.cfg.MaxUploadBytes); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "too_large", "Image is too large.")
		return
	}
	kind := r.FormValue("kind")
	if kind != "avatar" && kind != "court" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_kind", "kind must be avatar or court.")
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file_required", "Attach an image.")
		return
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ext, ok := imageExt[http.DetectContentType(head[:n])]
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_type", "Use a JPEG, PNG or WebP image.")
		return
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		writeDBError(w, r, err)
		return
	}

	ct := http.DetectContentType(head[:n])
	safe, outCT, err := sanitizeImage(ct, io.MultiReader(bytes.NewReader(head[:n]), f))
	if err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_type", "Use a JPEG, PNG or WebP image.")
		return
	}
	if outCT == "image/jpeg" {
		ext = ".jpg"
		ct = outCT
	} else if outCT == "image/png" {
		ext = ".png"
		ct = outCT
	}
	stored, err := s.media.Save(r.Context(), kind, uid(r), ext, ct, safe)
	if err != nil {
		if strings.Contains(err.Error(), "writable") || strings.Contains(err.Error(), "permission") {
			writeError(w, http.StatusInternalServerError, "upload_storage", "Upload storage is not available.")
			return
		}
		writeDBError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": stored})
}
