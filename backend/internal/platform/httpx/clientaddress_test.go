package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// ADR 0029, item 6: behind Caddy, the address of the client is the last
// value of X-Forwarded-For, but only for a connection from a trusted proxy.
func TestClientAddress(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("172.31.0.0/16")}
	tests := []struct {
		name      string
		remote    string
		forwarded string
		want      string
	}{
		{name: "trusted proxy", remote: "172.31.0.1:40000", forwarded: "203.0.113.7", want: "203.0.113.7:0"},
		{name: "trusted proxy, client sent its own value first", remote: "172.31.0.1:40000", forwarded: "1.1.1.1, 203.0.113.7", want: "203.0.113.7:0"},
		{name: "connection that is not a trusted proxy", remote: "198.51.100.9:5000", forwarded: "203.0.113.7", want: "198.51.100.9:5000"},
		{name: "trusted proxy with no header", remote: "172.31.0.1:40000", forwarded: "", want: "172.31.0.1:40000"},
		{name: "trusted proxy with a value that is not an address", remote: "172.31.0.1:40000", forwarded: "unknown", want: "172.31.0.1:40000"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got string
			handler := httpx.ClientAddress(trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = r.RemoteAddr
			}))
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req.RemoteAddr = tt.remote
			if tt.forwarded != "" {
				req.Header.Set("X-Forwarded-For", tt.forwarded)
			}

			handler.ServeHTTP(httptest.NewRecorder(), req)

			if got != tt.want {
				t.Errorf("RemoteAddr = %q, want %q", got, tt.want)
			}
		})
	}
}
