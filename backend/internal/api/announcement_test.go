package api_test

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"testing"
)

func TestAnnouncements(t *testing.T) {
	e := setup(t)
	admin := e.register("admin")
	ana := e.register("ana")
	ben := e.register("ben")

	// Nothing posted yet: no modal.
	_, none, _ := e.do(ana.Token, "GET", "/api/announcements/pending", nil)
	if none != nil {
		t.Fatalf("pending before any announcement = %v", none)
	}

	// Only admins post, list or upload flyers.
	e.must(403, ana.Token, "POST", "/api/admin/announcements", map[string]any{"title": "x"})
	e.must(403, ana.Token, "GET", "/api/admin/announcements", nil)
	if code := uploadFlyer(t, e.srv.URL, ana.Token); code != 403 {
		t.Fatalf("non-admin flyer upload = %d", code)
	}
	e.must(422, admin.Token, "POST", "/api/admin/announcements", map[string]any{"title": "  "})
	e.must(422, admin.Token, "POST", "/api/admin/announcements", map[string]any{"title": "x", "image_url": "https://evil.example/a.png"})
	e.must(422, admin.Token, "POST", "/api/admin/announcements", map[string]any{"title": "x", "link_url": "javascript:alert(1)"})
	e.must(422, admin.Token, "POST", "/api/admin/announcements", map[string]any{"title": "x", "link_url": "//evil.example"})

	if code := uploadFlyer(t, e.srv.URL, admin.Token); code != 201 {
		t.Fatalf("admin flyer upload = %d", code)
	}
	a, _ := e.must(201, admin.Token, "POST", "/api/admin/announcements", map[string]any{
		"title": "Les quêtes du jour arrivent", "body": "3 quêtes par jour, de l’XP et ta série.", "link_url": "/play", "cta_label": "Voir",
	})
	id := a["id"].(string)
	if a["notified"].(float64) < 3 { // admin, ana, ben (plus anyone else in the test database)
		t.Fatalf("notified = %v", a["notified"])
	}

	// Everyone gets a notification…
	notes, _ := e.must(200, ana.Token, "GET", "/api/notifications", nil)
	found := false
	for _, n := range notes["items"].([]any) {
		m := n.(map[string]any)
		if d, _ := m["data"].(map[string]any); d != nil && d["announcement_id"] == id {
			found = m["title"] == "Les quêtes du jour arrivent" && m["read"] == false
		}
	}
	if !found {
		t.Fatalf("announcement notification missing: %v", notes)
	}
	// …and the modal shows until it's been seen.
	p, _ := e.must(200, ana.Token, "GET", "/api/announcements/pending", nil)
	if p["id"] != id || p["link_url"] != "/play" || p["cta_label"] != "Voir" {
		t.Fatalf("pending = %v", p)
	}
	e.must(204, ana.Token, "POST", "/api/announcements/"+id+"/seen", nil)
	e.must(204, ana.Token, "POST", "/api/announcements/"+id+"/seen", nil) // idempotent
	if _, again, _ := e.do(ana.Token, "GET", "/api/announcements/pending", nil); again != nil {
		t.Fatalf("pending after seen = %v", again)
	}
	notes, _ = e.must(200, ana.Token, "GET", "/api/notifications", nil)
	for _, n := range notes["items"].([]any) {
		m := n.(map[string]any)
		if d, _ := m["data"].(map[string]any); d != nil && d["announcement_id"] == id && m["read"] != true {
			t.Fatalf("notification not marked read after seeing the modal: %v", m)
		}
	}
	// It can still be opened from Alerts.
	g, _ := e.must(200, ana.Token, "GET", "/api/announcements/"+id, nil)
	if g["title"] != "Les quêtes du jour arrivent" {
		t.Fatalf("get = %v", g)
	}
	e.must(404, ana.Token, "POST", "/api/announcements/00000000-0000-0000-0000-000000000000/seen", nil)

	// Admin list counts views.
	_, list := e.must(200, admin.Token, "GET", "/api/admin/announcements", nil)
	if len(list) != 1 || list[0].(map[string]any)["seen"] != 1.0 {
		t.Fatalf("admin list = %v", list)
	}

	// Switching it off hides it for people who haven't seen it yet.
	e.must(204, admin.Token, "PATCH", "/api/admin/announcements/"+id, map[string]any{"active": false})
	if _, off, _ := e.do(ben.Token, "GET", "/api/announcements/pending", nil); off != nil {
		t.Fatalf("inactive announcement still pending: %v", off)
	}
	e.must(404, ben.Token, "GET", "/api/announcements/"+id, nil)
	e.must(404, admin.Token, "PATCH", "/api/admin/announcements/00000000-0000-0000-0000-000000000000", map[string]any{"active": true})

	// Without notify, no notification is sent, but the modal still shows.
	b, _ := e.must(201, admin.Token, "POST", "/api/admin/announcements", map[string]any{"title": "Silencieux", "notify": false})
	if b["notified"] != 0.0 {
		t.Fatalf("notify=false notified = %v", b["notified"])
	}
	p2, _ := e.must(200, ben.Token, "GET", "/api/announcements/pending", nil)
	if p2["title"] != "Silencieux" {
		t.Fatalf("pending without notify = %v", p2)
	}
}

func uploadFlyer(t *testing.T, base, token string) int {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	img.Set(1, 1, color.RGBA{255, 90, 31, 255})
	var pngBuf bytes.Buffer
	_ = png.Encode(&pngBuf, img)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("kind", "announcement")
	fw, _ := mw.CreateFormFile("file", "flyer.png")
	_, _ = fw.Write(pngBuf.Bytes())
	_ = mw.Close()
	req, _ := http.NewRequest("POST", base+"/api/uploads", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}
