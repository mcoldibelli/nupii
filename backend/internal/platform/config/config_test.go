package config_test

import (
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
)

func env(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
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
