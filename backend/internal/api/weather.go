package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

const (
	defaultWeatherURL = "https://api.open-meteo.com/v1/forecast"
	weatherTTL        = 30 * time.Minute
	weatherDays       = 10
)

// weatherHour is one hourly forecast slot (times are unix seconds, UTC).
type weatherHour struct {
	Time   int64   `json:"t"`
	Temp   float64 `json:"temp"`
	Rain   int     `json:"rain_pct"`
	Precip float64 `json:"precip_mm"`
	Code   int     `json:"code"`
	Wind   float64 `json:"wind_kmh"`
}

type weatherForecast struct {
	Hours []weatherHour `json:"hours"`
}

type weatherEntry struct {
	at   time.Time
	data []byte
}

// weatherCache proxies Open-Meteo (free, no key) and caches forecasts per ~2 km cell,
// so a busy court costs one upstream call every half hour.
type weatherCache struct {
	url    string
	client *http.Client
	mu     sync.Mutex
	items  map[string]weatherEntry
}

func newWeatherCache(u string) *weatherCache {
	if u == "" {
		u = defaultWeatherURL
	}
	return &weatherCache{url: u, client: &http.Client{Timeout: 6 * time.Second}, items: map[string]weatherEntry{}}
}

func (c *weatherCache) get(ctx context.Context, lat, lng float64) ([]byte, error) {
	lat = math.Round(lat*50) / 50
	lng = math.Round(lng*50) / 50
	key := fmt.Sprintf("%.2f,%.2f", lat, lng)
	c.mu.Lock()
	if e, ok := c.items[key]; ok && time.Since(e.at) < weatherTTL {
		c.mu.Unlock()
		return e.data, nil
	}
	c.mu.Unlock()

	q := url.Values{}
	q.Set("latitude", fmt.Sprintf("%.2f", lat))
	q.Set("longitude", fmt.Sprintf("%.2f", lng))
	q.Set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m")
	q.Set("forecast_days", fmt.Sprint(weatherDays))
	q.Set("past_days", "2")
	q.Set("timezone", "UTC")
	q.Set("timeformat", "unixtime")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("weather upstream: %s", resp.Status)
	}
	var raw struct {
		Hourly struct {
			Time   []int64    `json:"time"`
			Temp   []*float64 `json:"temperature_2m"`
			Rain   []*float64 `json:"precipitation_probability"`
			Precip []*float64 `json:"precipitation"`
			Code   []*float64 `json:"weather_code"`
			Wind   []*float64 `json:"wind_speed_10m"`
		} `json:"hourly"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	h := raw.Hourly
	at := func(xs []*float64, i int) float64 {
		if i < len(xs) && xs[i] != nil {
			return *xs[i]
		}
		return 0
	}
	out := weatherForecast{Hours: make([]weatherHour, 0, len(h.Time))}
	for i, t := range h.Time {
		out.Hours = append(out.Hours, weatherHour{
			Time: t, Temp: math.Round(at(h.Temp, i)*10) / 10, Rain: int(at(h.Rain, i)),
			Precip: at(h.Precip, i), Code: int(at(h.Code, i)), Wind: math.Round(at(h.Wind, i)),
		})
	}
	if len(out.Hours) == 0 {
		return nil, errors.New("weather upstream: empty forecast")
	}
	b, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	if len(c.items) > 2000 {
		for k, e := range c.items {
			if time.Since(e.at) >= weatherTTL {
				delete(c.items, k)
			}
		}
	}
	c.items[key] = weatherEntry{at: time.Now(), data: b}
	c.mu.Unlock()
	return b, nil
}

// courtWeather returns the hourly forecast (next ~10 days) at a court.
func (s *Server) courtWeather(w http.ResponseWriter, r *http.Request) {
	b, err := s.db.JSON(r.Context(), uid(r),
		`select jsonb_build_object('lat', latitude, 'lng', longitude) from courts where id = $1`, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	var c struct{ Lat, Lng float64 }
	if err := json.Unmarshal(b, &c); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Court not found.")
		return
	}
	data, err := s.weather.get(r.Context(), c.Lat, c.Lng)
	if err != nil {
		writeError(w, http.StatusBadGateway, "weather_unavailable", "Weather is unavailable right now.")
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=600")
	writeRaw(w, http.StatusOK, data)
}

// courtRainSoon marks courts where rain is likely in the next 3 hours.
type courtRainSoon struct {
	RainPct int   `json:"rain_pct"`
	At      int64 `json:"at"`  // unix time of the wettest hour
	Now     bool  `json:"now"` // raining in the current hour
}

// courtsRain answers, for up to 150 courts (?ids=a,b,c), which ones expect rain
// soon. Courts share cached forecasts per ~2 km cell, so a whole map costs a
// handful of upstream calls at most every 30 minutes.
func (s *Server) courtsRain(w http.ResponseWriter, r *http.Request) {
	ids := strings.Split(r.URL.Query().Get("ids"), ",")
	if len(ids) > 150 {
		ids = ids[:150]
	}
	clean := make([]string, 0, len(ids))
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" {
			clean = append(clean, id)
		}
	}
	out := map[string]courtRainSoon{}
	if len(clean) == 0 {
		writeJSON(w, http.StatusOK, out)
		return
	}
	rows, err := s.db.Pool.Query(r.Context(), `select id::text, latitude, longitude from courts where id::text = any($1)`, clean)
	if err != nil {
		writeDBError(w, r, err)
		return
	}
	type court struct {
		id       string
		lat, lng float64
	}
	var courts []court
	for rows.Next() {
		var c court
		if err := rows.Scan(&c.id, &c.lat, &c.lng); err != nil {
			rows.Close()
			writeDBError(w, r, err)
			return
		}
		courts = append(courts, c)
	}
	rows.Close()

	// One forecast per cell, fetched in parallel (bounded).
	cell := func(c court) string {
		return fmt.Sprintf("%.2f,%.2f", math.Round(c.lat*50)/50, math.Round(c.lng*50)/50)
	}
	forecasts := map[string]*weatherForecast{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6)
	seen := map[string]bool{}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	for _, c := range courts {
		k := cell(c)
		if seen[k] || len(seen) >= 30 {
			continue
		}
		seen[k] = true
		wg.Add(1)
		go func(k string, c court) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			data, err := s.weather.get(ctx, c.lat, c.lng)
			if err != nil {
				return
			}
			var f weatherForecast
			if json.Unmarshal(data, &f) == nil {
				mu.Lock()
				forecasts[k] = &f
				mu.Unlock()
			}
		}(k, c)
	}
	wg.Wait()

	now := time.Now().Unix()
	hourStart := now - now%3600
	for _, c := range courts {
		f := forecasts[cell(c)]
		if f == nil {
			continue
		}
		var best *weatherHour
		raining := false
		for i, h := range f.Hours {
			if h.Time < hourStart || h.Time > now+3*3600 {
				continue
			}
			wet := h.Precip >= 0.3 || (h.Code >= 51 && h.Code <= 67) || h.Code >= 80
			if h.Time == hourStart && wet {
				raining = true
			}
			if best == nil || h.Rain > best.Rain {
				best = &f.Hours[i]
			}
		}
		if best != nil && (raining || best.Rain >= 50) {
			out[c.id] = courtRainSoon{RainPct: best.Rain, At: best.Time, Now: raining}
		}
	}
	w.Header().Set("Cache-Control", "private, max-age=600")
	writeJSON(w, http.StatusOK, out)
}
