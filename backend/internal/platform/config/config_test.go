package config_test

import (
	"maps"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
)

const databaseURL = "postgres://user:password@localhost:5432/database"

// env returns a getenv function with a valid configuration, changed by vars.
// A variable with an empty value in vars is not set.
func env(vars map[string]string) func(string) string {
	all := map[string]string{"DATABASE_URL": databaseURL}
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
			if cfg.DatabaseURL != databaseURL {
				t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, databaseURL)
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
