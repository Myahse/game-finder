package avatar

// Allowed asset IDs — must stay in sync with web/src/avatar/registry.ts

var (
	bodyTypes = map[string]bool{
		"slim": true, "average": true, "athletic": true, "muscular": true, "larger": true,
	}
	skinTones = map[string]bool{
		"skin_01": true, "skin_02": true, "skin_03": true, "skin_04": true,
		"skin_05": true, "skin_06": true, "skin_07": true, "skin_08": true,
		"skin_09": true, "skin_10": true, "skin_11": true, "skin_12": true,
	}
	faces = map[string]bool{
		"face_oval": true, "face_round": true, "face_square": true,
		"face_heart": true, "face_long": true, "face_angular": true,
	}
	eyes = map[string]bool{
		"eyes_01": true, "eyes_02": true, "eyes_03": true, "eyes_04": true, "eyes_05": true, "eyes_wink": true,
	}
	eyebrows = map[string]bool{
		"brow_straight": true, "brow_curved": true, "brow_thick": true,
		"brow_thin": true, "brow_athletic": true, "brow_expressive": true,
	}
	noses = map[string]bool{
		"nose_small": true, "nose_medium": true, "nose_large": true,
		"nose_straight": true, "nose_rounded": true, "nose_wide": true, "nose_narrow": true,
	}
	mouths = map[string]bool{
		"mouth_neutral": true, "mouth_smile": true, "mouth_big_smile": true,
		"mouth_serious": true, "mouth_confident": true, "mouth_relaxed": true,
	}
	hairs = map[string]bool{
		"hair_buzz": true, "hair_fade_low": true, "hair_fade_mid": true, "hair_fade_high": true,
		"hair_crop": true, "hair_curls_short": true, "hair_wavy_med": true, "hair_afro": true,
		"hair_twists": true, "hair_locs": true, "hair_braids": true, "hair_ponytail": true,
		"hair_box_braids": true, "hair_cornrows": true,
		"hair_hightop": true, "hair_mohawk": true, "hair_bun": true, "hair_bantu_knots": true,
		"hair_headwrap": true, "hair_long_straight": true, "hair_pixie": true, "hair_puff": true,
		// Avataaars-backed styles (older ids above stay valid for saved avatars)
		"hair_short_flat": true, "hair_short_round": true, "hair_side_part": true, "hair_waves": true,
		"hair_quiff": true, "hair_locs_long": true, "hair_curly": true, "hair_long_curly": true,
		"hair_big": true, "hair_braid_crown": true, "hair_bob": true, "hair_bob_bangs": true,
		"hair_shaggy": true, "hair_mullet": true, "hair_shaved_side": true, "hair_long_wavy": true,
		"hair_long_sleek": true, "hair_long_strand": true, "hair_balding": true, "hair_hijab": true,
	}
	hairColors = map[string]bool{
		"black": true, "dark_brown": true, "brown": true, "light_brown": true,
		"blonde": true, "platinum": true, "red": true, "grey": true,
	}
	facialHairs = map[string]bool{
		"beard_none": true, "beard_stubble": true, "beard_mustache": true,
		"beard_short": true, "beard_full": true, "beard_goatee": true, "beard_full_mustache": true,
	}
	tops = map[string]bool{
		"top_basketball_jersey": true, "top_football_jersey": true, "top_tennis_shirt": true,
		"top_badminton_shirt": true, "top_running_shirt": true, "top_compression": true,
		"top_hoodie": true, "top_tank": true, "top_tee": true, "top_sports_bra": true,
	}
	bottoms = map[string]bool{
		"bottom_basketball_shorts": true, "bottom_football_shorts": true, "bottom_tennis_shorts": true,
		"bottom_running_shorts": true, "bottom_sweatpants": true, "bottom_athletic_pants": true,
		"bottom_leggings": true, "bottom_tennis_skirt": true,
	}
	shoes = map[string]bool{
		"shoes_basketball": true, "shoes_football": true, "shoes_tennis": true,
		"shoes_running": true, "shoes_badminton": true, "shoes_sneakers": true,
	}
	headwear = map[string]bool{
		"head_cap": true, "head_headband": true, "head_bandana": true,
		"head_beanie": true, "head_bobble": true, "head_earflap": true,
	}
	eyewear = map[string]bool{
		"eye_glasses": true, "eye_sunglasses": true, "eye_sport": true, "eye_round": true,
	}
	accessories = map[string]bool{
		"acc_wristbands": true, "acc_watch": true, "acc_necklace": true, "acc_earrings": true,
	}
	sports = map[string]bool{
		"basketball": true, "football": true, "tennis": true, "badminton": true,
		"volleyball": true, "running": true, "gym": true,
	}
	equipment = map[string]bool{
		"eq_basketball": true, "eq_football": true, "eq_tennis_racket": true,
		"eq_badminton_racket": true, "eq_volleyball": true, "eq_water_bottle": true, "eq_dumbbells": true,
	}
	poses = map[string]bool{"standing": true, "action": true}

	// Optional fields (added later; empty = default look).
	figures    = map[string]bool{"straight": true, "curvy": true}
	eyeColors  = map[string]bool{"brown": true, "dark": true, "hazel": true, "green": true, "blue": true, "grey": true}
	lashStyles = map[string]bool{"none": true, "natural": true, "bold": true}
	lipColors  = map[string]bool{"natural": true, "nude": true, "rose": true, "berry": true, "red": true}
	details    = map[string]bool{
		"freckles": true, "beauty_mark": true, "dimples": true, "face_paint": true,
		"tattoo_arm": true, "tattoo_sleeve": true,
	}
	kitColors = map[string]bool{
		"red": true, "orange": true, "gold": true, "green": true, "teal": true, "sky": true, "blue": true,
		"navy": true, "purple": true, "pink": true, "maroon": true, "black": true, "white": true, "grey": true,
	}
)
