package httpx

import (
	"net"
	"net/http"
	"net/netip"
	"strings"
)

// ClientAddress returns a middleware that puts the address of the client in
// r.RemoteAddr when the connection comes from a trusted proxy (ADR 0029,
// item 6). The proxy (Caddy) adds the address it sees at the end of
// X-Forwarded-For, so the last value is the one to trust. A connection from
// any other address keeps its own address: a client cannot choose the value.
func ClientAddress(trusted []netip.Prefix) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if client, ok := forwardedClient(r, trusted); ok {
				r.RemoteAddr = net.JoinHostPort(client.String(), "0")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// forwardedClient returns the last address of X-Forwarded-For, if the
// connection comes from one of trusted.
func forwardedClient(r *http.Request, trusted []netip.Prefix) (netip.Addr, bool) {
	header := r.Header.Get("X-Forwarded-For")
	if header == "" {
		return netip.Addr{}, false
	}
	remote, err := netip.ParseAddrPort(r.RemoteAddr)
	if err != nil || !isTrusted(remote.Addr().Unmap(), trusted) {
		return netip.Addr{}, false
	}
	values := strings.Split(header, ",")
	client, err := netip.ParseAddr(strings.TrimSpace(values[len(values)-1]))
	if err != nil {
		return netip.Addr{}, false
	}
	return client, true
}

func isTrusted(addr netip.Addr, trusted []netip.Prefix) bool {
	for _, prefix := range trusted {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}
