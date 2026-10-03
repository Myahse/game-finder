package api

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"

	"golang.org/x/image/webp"
)

// sanitizeImage decodes and re-encodes uploads to drop polyglot/trailing payloads.
func sanitizeImage(contentType string, body io.Reader) (io.Reader, string, error) {
	raw, err := io.ReadAll(body)
	if err != nil {
		return nil, "", err
	}
	var img image.Image
	switch contentType {
	case "image/jpeg":
		img, err = jpeg.Decode(bytes.NewReader(raw))
	case "image/png":
		img, err = png.Decode(bytes.NewReader(raw))
	case "image/webp":
		img, err = webp.Decode(bytes.NewReader(raw))
	default:
		return nil, "", fmt.Errorf("unsupported type")
	}
	if err != nil {
		return nil, "", err
	}
	var buf bytes.Buffer
	switch contentType {
	case "image/png":
		if err := png.Encode(&buf, img); err != nil {
			return nil, "", err
		}
		return bytes.NewReader(buf.Bytes()), "image/png", nil
	default:
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
			return nil, "", err
		}
		outType := "image/jpeg"
		if contentType == "image/jpeg" {
			outType = "image/jpeg"
		} else {
			outType = "image/jpeg" // webp → jpeg
		}
		return bytes.NewReader(buf.Bytes()), outType, nil
	}
}
