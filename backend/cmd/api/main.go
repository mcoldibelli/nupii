// Command api is the Nupii API server.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/mcoldibelli/nupii/backend/db/migrations"
	"github.com/mcoldibelli/nupii/backend/internal/alerts"
	"github.com/mcoldibelli/nupii/backend/internal/biometrics"
	"github.com/mcoldibelli/nupii/backend/internal/platform/config"
	"github.com/mcoldibelli/nupii/backend/internal/platform/firebase"
	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/jobs"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
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
	// _readTimeout is the time a client has to send one request. A photo
	// of 8 MB on a slow mobile network (200 KB per second) takes 45 seconds.
	_readTimeout = 2 * time.Minute
	// _writeTimeout is the time from the end of the request headers to the
	// end of the answer. It is more than _readTimeout plus the time of one
	// call to the inference service.
	_writeTimeout = 3 * time.Minute
	// _idleTimeout is the time a connection stays open with no request.
	_idleTimeout = 2 * time.Minute
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
	photos := storage.New(storage.Config{
		Endpoint:        cfg.StorageEndpoint,
		PublicEndpoint:  cfg.StoragePublicEndpoint,
		Bucket:          cfg.StorageBucket,
		Region:          cfg.StorageRegion,
		AccessKeyID:     cfg.StorageAccessKeyID,
		SecretAccessKey: cfg.StorageSecretAccessKey,
	})
	var pusher alerts.Pusher
	// RN-36: o push só é enviado com a credencial configurada.
	if cfg.PushEnabled {
		sender, err := firebase.NewPusher(startCtx, cfg.FirebaseProjectID)
		if err != nil {
			return fmt.Errorf("create the push sender: %w", err)
		}
		pusher = firebasePusher{firebase: sender}
	} else {
		logger.InfoContext(ctx, "push notifications are off: no credential of firebase")
	}
	operations := newServer(logger, pool, photos, inference.New(cfg.InferenceURL))

	// RF-32, RN-42: the start writes the next daily purge.
	if err := schedulePurge(ctx, pool, time.Now()); err != nil {
		return err
	}

	listener, err := net.Listen("tcp", cfg.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", cfg.HTTPAddr, err)
	}
	srv := &http.Server{
		Handler: newHandler(
			logger, operations, tokenVerifier{firebase: verifier}, operations.owners, cfg.WebOrigins, cfg.TrustedProxies),
		ReadHeaderTimeout: _readHeaderTimeout,
		ReadTimeout:       _readTimeout,
		WriteTimeout:      _writeTimeout,
		IdleTimeout:       _idleTimeout,
	}

	// The goroutine ends when Serve returns: after a failure, or after
	// Shutdown. The buffer lets it send the result and end in the two cases.
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(listener) }()
	logger.InfoContext(ctx, "http server started", slog.String("addr", listener.Addr().String()))

	// RN-67: o recálculo dos vetores é executado na subida da API.
	// The goroutine ends when the recompute ends or when its context is
	// cancelled: each call of the recompute stops with the context. run
	// cancels the context and waits for the goroutine before it returns.
	backgroundCtx, cancelBackground := context.WithCancel(ctx)
	var background sync.WaitGroup
	background.Go(func() { reembedNoseprints(backgroundCtx, logger, operations.noseprints) })
	// RNF-01: um alerta de desaparecimento não se perde quando o processo
	// para. The jobs that wait in the database run from the start of the
	// API. Run ends the job in progress and returns when the context ends.
	handlers := alerts.JobHandlers(pusher)
	// RN-03: a job deletes the user of a deleted account in Firebase.
	maps.Copy(handlers, operations.accounts.JobHandlers(verifier))
	// The objects that a transaction made unused leave the store after it.
	maps.Copy(handlers, storage.JobHandlers(photos, logger))
	// RF-32, RN-42: a limpeza diária. Each purge writes the one after it.
	handlers[_jobPurge] = operations.purge
	runner := jobs.NewRunner(pool, logger, handlers)
	background.Go(func() { runner.Run(backgroundCtx) })
	defer func() {
		cancelBackground()
		background.Wait()
	}()

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

// reembedNoseprints makes the vectors of the noseprints of another model
// version, and writes the result to the log. A failure does not stop the
// API: the noseprints that are left stay for the next start.
func reembedNoseprints(ctx context.Context, logger *slog.Logger, noseprints *biometrics.Service) {
	result, err := noseprints.Reembed(ctx)
	counts := []any{
		slog.String("model_version", result.ModelVersion),
		slog.Int("pending", result.Pending),
		slog.Int("updated", result.Updated),
		slog.Int("skipped", result.Skipped),
	}
	if err != nil {
		// The inference service can be off when the API starts. Another
		// failure is an error of the system.
		level := slog.LevelError
		if errors.Is(err, inference.ErrUnavailable) || ctx.Err() != nil {
			level = slog.LevelWarn
		}
		logger.Log(ctx, level, "recompute of the noseprint vectors stopped",
			append(counts, slog.Any("error", err))...)
		return
	}
	logger.InfoContext(ctx, "recompute of the noseprint vectors ended", counts...)
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
