package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"findthegame/backend/internal/config"
)

// Media stores avatars and court photos (local disk or Cloudflare R2).
type Media struct {
	localDir   string
	publicBase string
	r2Public   string
	r2Bucket   string
	r2         *s3.Client
}

func NewMedia(cfg config.Config) (*Media, error) {
	m := &Media{
		localDir:   cfg.UploadDir,
		publicBase: strings.TrimRight(cfg.PublicBaseURL, "/"),
		r2Public:   strings.TrimRight(cfg.R2PublicURL, "/"),
		r2Bucket:   cfg.R2BucketName,
	}
	if !cfg.R2Enabled() {
		return m, nil
	}
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{URL: endpoint, SigningRegion: "auto"}, nil
	})
	awscfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, "")),
		awsconfig.WithRegion("auto"),
		awsconfig.WithEndpointResolverWithOptions(resolver),
	)
	if err != nil {
		return nil, err
	}
	m.r2 = s3.NewFromConfig(awscfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})
	return m, nil
}

func (m *Media) UsesR2() bool { return m.r2 != nil }

// Save writes an image and returns the URL stored in the database.
func (m *Media) Save(ctx context.Context, kind, userID, ext, contentType string, body io.Reader) (string, error) {
	if kind != "avatar" && kind != "court" {
		return "", fmt.Errorf("invalid kind")
	}
	rnd := make([]byte, 16)
	if _, err := rand.Read(rnd); err != nil {
		return "", err
	}
	key := fmt.Sprintf("%s/%s/%s%s", kind, userID, hex.EncodeToString(rnd), ext)

	if m.r2 != nil {
		if m.r2Public == "" {
			return "", fmt.Errorf("R2_PUBLIC_URL is required when R2 is configured")
		}
		_, err := m.r2.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(m.r2Bucket),
			Key:         aws.String(key),
			Body:        body,
			ContentType: aws.String(contentType),
		})
		if err != nil {
			return "", err
		}
		return m.r2Public + "/" + key, nil
	}

	dst := filepath.Join(m.localDir, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return "", err
	}
	f, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, body); err != nil {
		f.Close()
		os.Remove(dst)
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	return "/uploads/" + strings.ReplaceAll(key, "\\", "/"), nil
}

// AllowedStoredURL rejects arbitrary third-party image hosts.
func (m *Media) AllowedStoredURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true
	}
	if strings.Contains(raw, "..") {
		return false
	}
	if strings.HasPrefix(raw, "/uploads/") {
		return true
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "javascript" {
		return false
	}
	if strings.HasPrefix(u.Path, "/uploads/") {
		return true
	}
	if m.r2Public != "" {
		pub, err := url.Parse(m.r2Public)
		if err == nil && strings.EqualFold(u.Host, pub.Host) {
			return strings.HasPrefix(u.Path, "/avatar/") || strings.HasPrefix(u.Path, "/court/")
		}
	}
	return false
}
