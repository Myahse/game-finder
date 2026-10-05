package api

import (
	"strings"
)

const avatarPresetV1Prefix = "preset:v1."

var (
	avatarSkinIDs       = map[string]bool{"s0": true, "s1": true, "s2": true, "s3": true, "s4": true, "s5": true}
	avatarHairIDs       = map[string]bool{"h0": true, "h1": true, "h2": true, "h3": true, "h4": true, "h5": true}
	avatarJerseyIDs     = map[string]bool{"j0": true, "j1": true, "j2": true, "j3": true, "j4": true, "j5": true, "j6": true, "j7": true}
	avatarBodyIDs       = map[string]bool{"b0": true, "b1": true, "b2": true}
	avatarSizeIDs       = map[string]bool{"z0": true, "z1": true, "z2": true, "z3": true}
	avatarAccessoryIDs  = map[string]bool{"a0": true, "a1": true, "a2": true, "a3": true, "a4": true}
	avatarOutfitIDs     = map[string]bool{"o0": true, "o1": true, "o2": true, "o3": true}
)

func isAvatarPresetV1URL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, avatarPresetV1Prefix) {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(raw, avatarPresetV1Prefix), ".")
	if len(parts) != 3 {
		return false
	}
	return avatarSkinIDs[parts[0]] && avatarHairIDs[parts[1]] && avatarJerseyIDs[parts[2]]
}

func isAvatarPresetURL(raw string) bool {
	return isAvatarPresetV1URL(raw) || isAvatarPresetV2URL(raw)
}
