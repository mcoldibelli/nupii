package config_test

import (
	"maps"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
)

const (
	_databaseURL = "postgres://user:password@localhost:5432/database"
	// _testValue is the value of a variable whose content the tests do not read.
	_testValue = "value-for-the-test"
)

// env returns a getenv function with a valid configuration, changed by vars.
// A variable with an empty value in vars is not set.
func env(vars map[string]string) func(string) string {
	all := map[string]string{
		"DATABASE_URL":         _databaseURL,
		"FIREBASE_PROJECT_ID":  "demo-test",
		"S3_ENDPOINT":          "http://s3.test:8333",
		"S3_BUCKET":            "bucket",
		"S3_ACCESS_KEY_ID":     "key-id",
		"S3_SECRET_ACCESS_KEY": _testValue,
	}
	maps.Copy(all, vars)
	return func(key string) string { return all[key] }
}

func TestLoad(t *testing.T) {
	tests := []struct {
		name     string
		vars     map[string]string
		wantAddr string
	}{
		{name: "default address", vars: nil, wantAddr: ":8080"},
		{name: "address from HTTP_ADDR", vars: map[string]string{"HTTP_ADDR": "127.0.0.1:9090"}, wantAddr: "127.0.0.1:9090"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := config.Load(env(tt.vars))
			if err != nil {
				t.Fatalf("Load: %v", err)
			}
			if cfg.HTTPAddr != tt.wantAddr {
				t.Errorf("HTTPAddr = %q, want %q", cfg.HTTPAddr, tt.wantAddr)
			}
			if cfg.DatabaseURL != _databaseURL {
				t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, _databaseURL)
			}
		})
	}
}

// RNF-06: the process does not start with an invalid configuration.
func TestLoadRejectsInvalidAddress(t *testing.T) {
	for _, addr := range []string{"no-port", ":http", ":70000", "localhost:"} {
		t.Run(addr, func(t *testing.T) {
			if _, err := config.Load(env(map[string]string{"HTTP_ADDR": addr})); err == nil {
				t.Errorf("Load with HTTP_ADDR=%q: got nil error, want an error", addr)
			}
		})
	}
}

// RNF-06: the process does not start with an invalid configuration.
func TestLoadRejectsInvalidDatabaseURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{name: "not set", url: ""},
		{name: "not a URL", url: "localhost:5432"},
		{name: "scheme of another database", url: "mysql://user:password@localhost/database"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := config.Load(env(map[string]string{"DATABASE_URL": tt.url})); err == nil {
				t.Errorf("Load with DATABASE_URL=%q: got nil error, want an error", tt.url)
			}
		})
	}
}

// RNF-06: the process does not start with an invalid configuration.
func TestLoadRejectsMissingFirebaseProjectID(t *testing.T) {
	if _, err := config.Load(env(map[string]string{"FIREBASE_PROJECT_ID": ""})); err == nil {
		t.Error("Load without FIREBASE_PROJECT_ID: got nil error, want an error")
	}
}

func TestLoadReadsTheFirebaseVariables(t *testing.T) {
	cfg, err := config.Load(env(map[string]string{"FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099"}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.FirebaseProjectID != "demo-test" || cfg.FirebaseAuthEmulatorHost != "127.0.0.1:9099" {
		t.Errorf("FirebaseProjectID = %q, FirebaseAuthEmulatorHost = %q, want demo-test and 127.0.0.1:9099",
			cfg.FirebaseProjectID, cfg.FirebaseAuthEmulatorHost)
	}
}

// With the emulator, the ID tokens have no signature. The process does not
// start with the emulator and a project that is not a demonstration project.
func TestLoadRejectsTheEmulatorWithARealProject(t *testing.T) {
	vars := map[string]string{
		"FIREBASE_PROJECT_ID":         "real-project",
		"FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
	}
	if _, err := config.Load(env(vars)); err == nil {
		t.Error("Load with the emulator and the project real-project: got nil error, want an error")
	}
}

func TestLoadReadsTheStorageVariables(t *testing.T) {
	cfg, err := config.Load(env(nil))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.StorageEndpoint != "http://s3.test:8333" || cfg.StorageBucket != "bucket" {
		t.Errorf("StorageEndpoint = %q, StorageBucket = %q, want the values of the variables", cfg.StorageEndpoint, cfg.StorageBucket)
	}
	if cfg.StoragePublicEndpoint != cfg.StorageEndpoint {
		t.Errorf("StoragePublicEndpoint = %q, want the default: the value of S3_ENDPOINT", cfg.StoragePublicEndpoint)
	}
	if cfg.StorageRegion != "us-east-1" {
		t.Errorf("StorageRegion = %q, want the default us-east-1", cfg.StorageRegion)
	}

	cfg, err = config.Load(env(map[string]string{"S3_PUBLIC_ENDPOINT": "https://files.example.com"}))
	if err != nil {
		t.Fatalf("Load with S3_PUBLIC_ENDPOINT: %v", err)
	}
	if cfg.StoragePublicEndpoint != "https://files.example.com" {
		t.Errorf("StoragePublicEndpoint = %q, want https://files.example.com", cfg.StoragePublicEndpoint)
	}
}

// RNF-06: o processo não sobe com configuração inválida.
func TestLoadRejectsInvalidStorageConfiguration(t *testing.T) {
	tests := []struct {
		name string
		vars map[string]string
	}{
		{name: "no endpoint", vars: map[string]string{"S3_ENDPOINT": ""}},
		{name: "endpoint that is not an http address", vars: map[string]string{"S3_ENDPOINT": "s3.test:8333"}},
		{name: "public endpoint that is not an http address", vars: map[string]string{"S3_PUBLIC_ENDPOINT": "files"}},
		{name: "no bucket", vars: map[string]string{"S3_BUCKET": ""}},
		{name: "no access key", vars: map[string]string{"S3_ACCESS_KEY_ID": ""}},
		{name: "no secret", vars: map[string]string{"S3_SECRET_ACCESS_KEY": ""}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := config.Load(env(tt.vars)); err == nil {
				t.Errorf("Load with %v: got nil error, want an error", tt.vars)
			}
		})
	}
}
