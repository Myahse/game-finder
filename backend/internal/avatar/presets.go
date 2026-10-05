package avatar

// DefaultConfig returns a valid starter avatar for a sport slug.
func DefaultConfig(sport string) Config {
	if !sports[sport] {
		sport = "basketball"
	}
	c := Config{
		Version:      Version,
		BodyType:     "athletic",
		HeightM:      1.78,
		SkinTone:     "skin_04",
		Face:         "face_oval",
		Eyes:         "eyes_03",
		Eyebrows:     "brow_athletic",
		Nose:         "nose_medium",
		Mouth:        "mouth_smile",
		Hair:         "hair_fade_mid",
		HairColor:    "black",
		FacialHair:   "beard_none",
		Pose:         "standing",
		Sport:        sport,
		UseAsProfile: true,
	}
	ApplySportKit(&c, sport)
	return c
}

func ApplySportKit(c *Config, sport string) {
	switch sport {
	case "football":
		c.Top, c.Bottom, c.Shoes = "top_football_jersey", "bottom_football_shorts", "shoes_football"
		c.SportsEquipment = strPtr("eq_football")
	case "tennis":
		c.Top, c.Bottom, c.Shoes = "top_tennis_shirt", "bottom_tennis_shorts", "shoes_tennis"
		c.SportsEquipment = strPtr("eq_tennis_racket")
		c.Headwear = strPtr("head_cap")
	case "badminton":
		c.Top, c.Bottom, c.Shoes = "top_badminton_shirt", "bottom_running_shorts", "shoes_badminton"
		c.SportsEquipment = strPtr("eq_badminton_racket")
	case "volleyball":
		c.Top, c.Bottom, c.Shoes = "top_tank", "bottom_athletic_pants", "shoes_sneakers"
		c.SportsEquipment = strPtr("eq_volleyball")
	case "running":
		c.Top, c.Bottom, c.Shoes = "top_running_shirt", "bottom_running_shorts", "shoes_running"
		c.SportsEquipment = strPtr("eq_water_bottle")
	case "gym":
		c.Top, c.Bottom, c.Shoes = "top_tank", "bottom_athletic_pants", "shoes_sneakers"
		c.SportsEquipment = strPtr("eq_dumbbells")
	default:
		c.Top, c.Bottom, c.Shoes = "top_basketball_jersey", "bottom_basketball_shorts", "shoes_basketball"
		c.SportsEquipment = strPtr("eq_basketball")
		c.Accessory = strPtr("acc_wristbands")
	}
}

func strPtr(s string) *string { return &s }
