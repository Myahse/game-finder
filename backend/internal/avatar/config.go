package avatar

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const Version = 1
const ProfileMarkerURL = "avatar:player"

type Config struct {
	Version         int      `json:"version"`
	BodyType        string   `json:"bodyType"`
	HeightM         float64  `json:"height"`
	SkinTone        string   `json:"skinTone"`
	Face            string   `json:"face"`
	Eyes            string   `json:"eyes"`
	Eyebrows        string   `json:"eyebrows"`
	Nose            string   `json:"nose"`
	Mouth           string   `json:"mouth"`
	Hair            string   `json:"hair"`
	HairColor       string   `json:"hairColor"`
	FacialHair      string   `json:"facialHair"`
	Top             string   `json:"top"`
	Bottom          string   `json:"bottom"`
	Shoes           string   `json:"shoes"`
	Headwear        *string  `json:"headwear"`
	Eyewear         *string  `json:"eyewear"`
	Accessory       *string  `json:"accessory"`
	Sport           string   `json:"sport"`
	SportsEquipment *string  `json:"sportsEquipment"`
	Pose            string   `json:"pose"`
	UseAsProfile    bool     `json:"useAsProfile"`
}

func Parse(raw json.RawMessage) (*Config, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var c Config
	if err := json.Unmarshal(raw, &c); err != nil {
		return nil, err
	}
	if err := Validate(&c); err != nil {
		return nil, err
	}
	return &c, nil
}

func Validate(c *Config) error {
	if c == nil {
		return errors.New("missing config")
	}
	if c.Version != Version {
		return fmt.Errorf("unsupported avatar version %d", c.Version)
	}
	if c.HeightM < 1.45 || c.HeightM > 2.25 {
		return errors.New("height out of range")
	}
	check := func(id string, allowed map[string]bool, field string) error {
		if !allowed[id] {
			return fmt.Errorf("invalid %s", field)
		}
		return nil
	}
	if err := check(c.BodyType, bodyTypes, "bodyType"); err != nil {
		return err
	}
	if err := check(c.SkinTone, skinTones, "skinTone"); err != nil {
		return err
	}
	if err := check(c.Face, faces, "face"); err != nil {
		return err
	}
	if err := check(c.Eyes, eyes, "eyes"); err != nil {
		return err
	}
	if err := check(c.Eyebrows, eyebrows, "eyebrows"); err != nil {
		return err
	}
	if err := check(c.Nose, noses, "nose"); err != nil {
		return err
	}
	if err := check(c.Mouth, mouths, "mouth"); err != nil {
		return err
	}
	if err := check(c.Hair, hairs, "hair"); err != nil {
		return err
	}
	if err := check(c.HairColor, hairColors, "hairColor"); err != nil {
		return err
	}
	if err := check(c.FacialHair, facialHairs, "facialHair"); err != nil {
		return err
	}
	if err := check(c.Top, tops, "top"); err != nil {
		return err
	}
	if err := check(c.Bottom, bottoms, "bottom"); err != nil {
		return err
	}
	if err := check(c.Shoes, shoes, "shoes"); err != nil {
		return err
	}
	if err := check(c.Sport, sports, "sport"); err != nil {
		return err
	}
	if err := check(c.Pose, poses, "pose"); err != nil {
		return err
	}
	if c.Headwear != nil && *c.Headwear != "" && !headwear[*c.Headwear] {
		return errors.New("invalid headwear")
	}
	if c.Eyewear != nil && *c.Eyewear != "" && !eyewear[*c.Eyewear] {
		return errors.New("invalid eyewear")
	}
	if c.Accessory != nil && *c.Accessory != "" && !accessories[*c.Accessory] {
		return errors.New("invalid accessory")
	}
	if c.SportsEquipment != nil && *c.SportsEquipment != "" && !equipment[*c.SportsEquipment] {
		return errors.New("invalid sportsEquipment")
	}
	return nil
}

func Normalize(c *Config) {
	c.Version = Version
	c.BodyType = strings.TrimSpace(c.BodyType)
	c.SkinTone = strings.TrimSpace(c.SkinTone)
	if c.Headwear != nil && strings.TrimSpace(*c.Headwear) == "" {
		c.Headwear = nil
	}
	if c.Eyewear != nil && strings.TrimSpace(*c.Eyewear) == "" {
		c.Eyewear = nil
	}
	if c.Accessory != nil && strings.TrimSpace(*c.Accessory) == "" {
		c.Accessory = nil
	}
	if c.SportsEquipment != nil && strings.TrimSpace(*c.SportsEquipment) == "" {
		c.SportsEquipment = nil
	}
}
