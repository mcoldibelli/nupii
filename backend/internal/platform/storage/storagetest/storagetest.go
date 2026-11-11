// Package storagetest gives the integration tests the object store of the
// local environment.
package storagetest

import (
	"os"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
)

// Config returns the configuration of the object store, from the S3_*
// variables. An integration test without the store fails. It is not skipped.
func Config(t testing.TB) storage.Config {
	t.Helper()
	cfg := storage.Config{
		Endpoint:        os.Getenv("S3_ENDPOINT"),
		PublicEndpoint:  os.Getenv("S3_ENDPOINT"),
		Bucket:          os.Getenv("S3_BUCKET"),
		Region:          "us-east-1",
		AccessKeyID:     os.Getenv("S3_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("S3_SECRET_ACCESS_KEY"),
	}
	if cfg.Endpoint == "" || cfg.Bucket == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		t.Fatal("S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is not set: " +
			"start the compose and set the variables (see backend/README.md)")
	}
	return cfg
}
