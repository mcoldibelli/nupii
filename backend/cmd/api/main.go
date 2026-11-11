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

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
)

const (
	// _databaseStartTimeout is the time the process waits for the database
	// to respond and for the migrations to end, when the process starts.
	_databaseStartTimeout = 30 * time.Second
	// _healthcheckTimeout is the time the healthcheck command waits for the
	// answer of the API.
	_healthcheckTimeout = 3 * time.Second
	// _readHeaderTimeout is the time a client has to send the request headers.
	_readHeaderTimeout = 10 * time.Second
	// _shutdownTimeout is the time the requests in progress have to end
	// after the process gets a stop signal.
	_shutdownTimeout = 10 * time.Second
)

func main() {
	if err := runCommand(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "nupii api:", err)
		os.Exit(1)
	}
}

// runCommand runs the server, or the health check of the container when
// the first argument is "healthcheck".
func runCommand(args []string) error {
	if len(args) > 0 && args[0] == "healthcheck" {
		ctx, cancel := context.WithTimeout(context.Background(), _healthcheckTimeout)
		defer cancel()
		if err := healthcheck(ctx, os.Getenv); err != nil {
			return fmt.Errorf("healthcheck: %w", err)
		}
		return nil
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	return run(ctx, os.Getenv, os.Stdout)
}

// run connects to the database, applies the migrations, starts the HTTP
// server and blocks until ctx is canceled or the server fails. When ctx is
// canceled, run stops accepting connections, waits for the requests in
// progress and returns nil.
func run(ctx context.Context, getenv func(string) string, logOutput io.Writer) error {
	cfg, err := config.Load(getenv)
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	logger := slog.New(httpx.NewLogHandler(slog.NewJSONHandler(logOutput, nil)))

	startCtx, cancelStart := context.WithTimeout(ctx, _databaseStartTimeout)
	defer cancelStart()
	pool, err := postgres.Open(startCtx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer pool.Close()
	if err := postgres.Migrate(startCtx, pool, migrations.FS); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	logger.InfoContext(ctx, "database ready")

	verifier, err := firebase.NewVerifier(startCtx, cfg.FirebaseProjectID)
	if err != nil {
		return fmt.Errorf("create ID token verifier: %w", err)
	}
	if cfg.FirebaseAuthEmulatorHost != "" {
		logger.WarnContext(ctx,
			"firebase auth emulator in use: the signature of the ID tokens is not checked",
			slog.String("host", cfg.FirebaseAuthEmulatorHost))
	}
	operations := newServer(logger, pool)

	listener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", cfg.HTTPAddr, err)
	}
	srv := &http.Server{
		Handler:           newHandler(logger, operations, tokenVerifier{firebase: verifier}),
		ReadHeaderTimeout: _readHeaderTimeout,
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
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), _shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shut down http server: %w", err)
	}
	return nil
}

// healthcheck calls GET /v1/health of the API that runs on this machine,
// at the port of HTTP_ADDR. It returns an error when the answer is not 200.
// The container image has no shell and no HTTP client, so the health check
// of the container runs this binary with the argument "healthcheck".
func healthcheck(ctx context.Context, getenv func(string) string) (err error) {
	cfg, err := config.Load(getenv)
	if err != nil {
		return fmt.Errorf("load configuration: %w", err)
	}
	host, port, err := net.SplitHostPort(cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("split HTTP_ADDR: %w", err)
	}
	if host == "" {
		host = "127.0.0.1"
	}
	url := "http://" + net.JoinHostPort(host, port) + "/v1/health"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("call %s: %w", url, err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil && err == nil {
			err = fmt.Errorf("close response body: %w", cerr)
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("call %s: status %d", url, resp.StatusCode)
	}
	return nil
}
