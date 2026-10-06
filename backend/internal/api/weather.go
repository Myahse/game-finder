package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
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
