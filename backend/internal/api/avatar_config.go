package api

import (
	"encoding/json"
	"errors"
	"strings"
)

const avatarPresetV2Prefix = "preset:v2."

type avatarConfigV2 struct {
	V            int    `json:"v"`
	Skin         string `json:"skin"`
	Body         string `json:"body"`
	Size         string `json:"size"`
	Hair         string `json:"hair"`
	Accessory    string `json:"accessory"`
	Outfit       string `json:"outfit"`
	Color        string `json:"color"`
	UseAsProfile bool   `json:"use_as_profile"`
}

func (c avatarConfigV2) presetURL() string {
	return avatarPresetV2Prefix + c.Skin + "." + c.Body + "." + c.Size + "." + c.Hair + "." + c.Accessory + "." + c.Outfit + "." + c.Color
}

func parseAvatarConfigJSON(raw json.RawMessage) (*avatarConfigV2, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var c avatarConfigV2
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, err
	}
	if c.V != 2 {
		return nil, errors.New("invalid avatar config")
	}
	if !validAvatarConfigV2(c) {
		return nil, errors.New("invalid avatar config")
	}
	return &c, nil
}

func validAvatarConfigV2(c avatarConfigV2) bool {
	return avatarSkinIDs[c.Skin] &&
		avatarBodyIDs[c.Body] &&
		avatarSizeIDs[c.Size] &&
		avatarHairIDs[c.Hair] &&
		avatarAccessoryIDs[c.Accessory] &&
		avatarOutfitIDs[c.Outfit] &&
		avatarJerseyIDs[c.Color]
}

func isAvatarPresetV2URL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, avatarPresetV2Prefix) {
		return false
	}
	parts := strings.Split(strings.TrimPrefix(raw, avatarPresetV2Prefix), ".")
	if len(parts) != 7 {
		return false
	}
	c := avatarConfigV2{V: 2, Skin: parts[0], Body: parts[1], Size: parts[2], Hair: parts[3], Accessory: parts[4], Outfit: parts[5], Color: parts[6]}
	return validAvatarConfigV2(c)
}
