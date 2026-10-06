package api_test

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestPlayerLanguage(t *testing.T) {
	e := setup(t)
	ana := e.register("ana")
	ben := e.register("ben")

	// Sport names follow Accept-Language.
	get := func(lang string) []any {
		req, _ := http.NewRequest("GET", e.srv.URL+"/api/sports", nil)
		req.Header.Set("Accept-Language", lang)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out []any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return out
	}
	names := func(list []any) map[string]string {
		m := map[string]string{}
		for _, s := range list {
			sm := s.(map[string]any)
			m[sm["slug"].(string)] = sm["name"].(string)
		}
		return m
	}
	if fr := names(get("fr-FR,fr;q=0.9,en;q=0.8")); fr["basketball"] != "Basket-ball" || fr["volleyball"] != "Volley-ball" {
		t.Fatalf("fr sports = %v", fr)
	}
	if en := names(get("en-US")); en["basketball"] != "Basketball" {
		t.Fatalf("en sports = %v", en)
	}

	// GET /api/me with a French device stores the player's language…
	req, _ := http.NewRequest("GET", e.srv.URL+"/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+ben.Token)
	req.Header.Set("Accept-Language", "fr-CI,fr;q=0.9")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	// …so notifications created for them by someone else are in French.
	e.must(200, ana.Token, "POST", "/api/me/friend-requests", map[string]any{"username": "ben"})
	var title, body string
	if err := e.db.Pool.QueryRow(t.Context(), `select title, body from notifications where user_id = $1 and type = 'friend_request'`, ben.ID).Scan(&title, &body); err != nil {
		t.Fatal(err)
	}
	if title != "Demande d’ami" || body != "Ana veut devenir votre ami." {
		t.Fatalf("fr notification = %q / %q", title, body)
	}

	// Template coverage: every English template has a French version.
	cases := map[[2]string][2]string{
		{"Game reminder", "Basketball game at Terrain IUGB starts in 30 minutes."}:                                 {"Rappel de match", "Le match de Basket-ball à Terrain IUGB commence dans 30 minutes."},
		{"Game cancelled", "The game at Terrain IUGB was cancelled."}:                                              {"Match annulé", "Le match à Terrain IUGB a été annulé."},
		{"New badge: First win", `You unlocked the "First win" badge. Share it with your crew!`}:                   {"Nouveau badge : Première victoire", "Vous avez débloqué le badge « Première victoire ». Partagez-le avec votre équipe !"},
		{"⚔️ @kofi challenges you", "At Terrain IUGB now. Accept or decline."}:                                     {"⚔️ @kofi vous défie", "À Terrain IUGB maintenant. Acceptez ou refusez."},
		{"🔥 3-week streak", "Your streak ends Sunday. Play or check in at a court this weekend to keep it alive."}: {"🔥 Série de 3 semaines", "Votre série se termine dimanche. Jouez ou faites un check-in ce week-end pour la garder."},
		{"New game nearby", "Kofi started a Football game at Mockeyville (1.2 km)."}:                               {"Nouveau match près de vous", "Kofi a lancé un match de Football à Mockeyville (1.2 km)."},
		{"Unknown title", "Some other text."}:                                                                      {"Unknown title", "Some other text."},
	}
	for in, want := range cases {
		var gt, gb string
		if err := e.db.Pool.QueryRow(t.Context(), `select title, body from notification_text_fr($1, $2)`, in[0], in[1]).Scan(&gt, &gb); err != nil {
			t.Fatal(err)
		}
		if gt != want[0] || gb != want[1] {
			t.Errorf("%q / %q → %q / %q, want %q / %q", in[0], in[1], gt, gb, want[0], want[1])
		}
	}
}
