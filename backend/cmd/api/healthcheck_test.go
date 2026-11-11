package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// envFor returns a getenv function with a valid configuration whose
// HTTP_ADDR is the address of srv.
func envFor(srv *httptest.Server) func(string) string {
	return func(key string) string {
		switch key {
		case "HTTP_ADDR":
			return strings.TrimPrefix(srv.URL, "http://")
		case "DATABASE_URL":
			return "postgres://user:password@localhost:5432/database"
		case "FIREBASE_PROJECT_ID":
			return "demo-test"
		case "S3_ENDPOINT":
			return "http://s3.test:8333"
		case "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY":
			return "value-for-the-test"
		default:
			return ""
		}
	}
}

func TestHealthcheck(t *testing.T) {
	tests := []struct {
		name    string
		status  int
		wantErr bool
	}{
		{name: "the API answers 200", status: http.StatusOK, wantErr: false},
		{name: "the API answers 503", status: http.StatusServiceUnavailable, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotPath string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				w.WriteHeader(tt.status)
			}))
			defer srv.Close()

			err := healthcheck(t.Context(), envFor(srv))

			if (err != nil) != tt.wantErr {
				t.Errorf("healthcheck error = %v, want an error: %t", err, tt.wantErr)
			}
			if gotPath != "/v1/health" {
				t.Errorf("request path = %q, want /v1/health", gotPath)
			}
		})
	}
}

func TestHealthcheckFailsWhenTheAPIDoesNotAnswer(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	getenv := envFor(srv)
	srv.Close()

	if err := healthcheck(t.Context(), getenv); err == nil {
		t.Error("healthcheck with no server: got nil error, want an error")
	}
}
