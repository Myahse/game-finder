package avatar

import (
	"encoding/json"
	"testing"
)

func TestParseAcceptsLegacyConfigWithoutOptionalFields(t *testing.T) {
	c := DefaultConfig("football")
	raw, _ := json.Marshal(c)
	got, err := Parse(raw)
	if err != nil || got == nil {
		t.Fatalf("legacy config rejected: %v", err)
	}
}

func TestParseOptionalFields(t *testing.T) {
	base := DefaultConfig("volleyball")
	n := 7
	base.Figure, base.EyeColor, base.Lashes, base.LipColor = "curvy", "hazel", "bold", "berry"
	base.Details = []string{"freckles", "face_paint"}
	base.KitMain, base.KitTrim, base.Number = "navy", "gold", &n
	base.Hair, base.Top, base.Bottom = "hair_bantu_knots", "top_sports_bra", "bottom_leggings"
	raw, _ := json.Marshal(base)
	got, err := Parse(raw)
	if err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
	if got.Number == nil || *got.Number != 7 || got.KitMain != "navy" || len(got.Details) != 2 {
		t.Fatalf("optional fields lost: %+v", got)
	}

	bad := []func(c *Config){
		func(c *Config) { c.Figure = "other" },
		func(c *Config) { c.EyeColor = "violet" },
		func(c *Config) { c.KitMain = "#ff0000" },
		func(c *Config) { c.Details = []string{"freckles", "freckles"} },
		func(c *Config) { c.Details = []string{"tattoo_face"} },
		func(c *Config) { big := 100; c.Number = &big },
		func(c *Config) { neg := -1; c.Number = &neg },
	}
	for i, mutate := range bad {
		c := DefaultConfig("volleyball")
		mutate(&c)
		raw, _ := json.Marshal(c)
		if _, err := Parse(raw); err == nil {
			t.Fatalf("case %d: expected rejection", i)
		}
	}
}
