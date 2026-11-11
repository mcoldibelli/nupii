// Command api is the Nupii API server.
package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

const (
	// readHeaderTimeout is the time a client has to send the request headers.
	readHeaderTimeout = 10 * time.Second
	// shutdownTimeout is the time the requests in progress have to end
	// after the process gets a stop signal.
	shutdownTimeout = 10 * time.Second
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	err := run(ctx, os.Getenv, os.Stdout)
	stop()
	if err != nil {
		fmt.Fprintln(os.Stderr, "nupii api:", err)
		os.Exit(1)
	}
}

// run starts the HTTP server and blocks until ctx is canceled or the server
// fails. When ctx is canceled, run stops accepting connections, waits for
// the requests in progress and returns nil.
func run(ctx context.Context, getenv func(string) string, logOutput io.Writer) error {
	cfg, err := config.Load(getenv)
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(logOutput, nil)))

	listener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", cfg.HTTPAddr, err)
	}
	srv := &http.Server{
		Handler:           newHandler(logger),
		ReadHeaderTimeout: readHeaderTimeout,
	}

	// The goroutine ends when Serve returns: after a failure, or after
	// Shutdown. The buffer lets it send the result and end in the two cases.
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(listener) }()
	logger.InfoContext(ctx, "http server started", slog.String("addr", listener.Addr().String()))

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve http: %w", err)
	case <-ctx.Done():
	}

	logger.InfoContext(ctx, "http server stopping")
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shut down http server: %w", err)
	}
	return nil
}
