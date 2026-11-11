package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"
)

// _rateLimitedCode is the error code of the contract for a request over
// the limit.
const _rateLimitedCode = "rate_limited"

// requestCount is the number of requests of one client to one route, in the
// window that started at windowStart.
type requestCount struct {
	windowStart time.Time
	count       int
}

// RateLimit returns a middleware that accepts at most limit requests in
// each window, for each client address and each route. It answers 429 to
// the requests over the limit. Only the requests for which limited returns
// true are counted. now gives the time.
//
// The middleware must be after the router, because it reads the pattern of
// the route. The counts are in the memory of the process: they are per
// instance of the API, and they start at zero when the process starts.
func RateLimit(
	logger *slog.Logger,
	limit int,
	window time.Duration,
	limited func(*http.Request) bool,
	now func() time.Time,
) func(http.Handler) http.Handler {
	var (
		mu        sync.Mutex
		counts    = make(map[string]*requestCount)
		lastSweep = now()
	)
	// allow counts one request, and tells if it is in the limit.
	allow := func(key string) bool {
		mu.Lock()
		defer mu.Unlock()
		current := now()
		// Once in each window, the counts of the windows that ended are
		// deleted. Without this, the map grows with each new address.
		if current.Sub(lastSweep) >= window {
			for k, c := range counts {
				if current.Sub(c.windowStart) >= window {
					delete(counts, k)
				}
			}
			lastSweep = current
		}
		c, ok := counts[key]
		if !ok || current.Sub(c.windowStart) >= window {
			c = &requestCount{windowStart: current}
			counts[key] = c
		}
		c.count++
		return c.count <= limit
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if limited(r) && !allow(clientAddress(r)+" "+r.Pattern) {
				WriteError(r.Context(), logger, w, http.StatusTooManyRequests,
					_rateLimitedCode, "too many requests from this address, try again later")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientAddress returns the address of the client of the connection,
// without the port.
func clientAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		// The address has no port. The value is still a key for the client.
		return r.RemoteAddr
	}
	return host
}
