//go:build integration

package main

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage/storagetest"
)

// _emulatorProjectID is the project of the Authentication emulator of the
// local environment.
const _emulatorProjectID = "demo-nupii"

// emulatorHost returns the host:port of the Authentication emulator, from
// FIREBASE_AUTH_EMULATOR_HOST. The Firebase Admin SDK reads the same
// variable. An integration test without the emulator fails. It is not skipped.
func emulatorHost(t *testing.T) string {
	t.Helper()
	host := os.Getenv("FIREBASE_AUTH_EMULATOR_HOST")
	if host == "" {
		t.Fatal("FIREBASE_AUTH_EMULATOR_HOST is not set: start the compose and set the variable (see backend/README.md)")
	}
	return host
}

// freeAddr returns a local address with a port that is free now.
func freeAddr(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on a free port: %v", err)
	}
	addr := ln.Addr().String()
	if err := ln.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	return addr
}

func TestRunMigratesServesAndStops(t *testing.T) {
	url := postgrestest.URL(t)
	emulator := emulatorHost(t)
	store := storagetest.Config(t)
	addr := freeAddr(t)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	getenv := func(key string) string {
		switch key {
		case "HTTP_ADDR":
			return addr
		case "DATABASE_URL":
			return url
		case "FIREBASE_PROJECT_ID":
			return _emulatorProjectID
		case "FIREBASE_AUTH_EMULATOR_HOST":
			return emulator
		case "S3_ENDPOINT":
			return store.Endpoint
		case "INFERENCE_URL":
			// The API starts without a call to the inference service.
			return "http://127.0.0.1:1"
		case "S3_BUCKET":
			return store.Bucket
		case "S3_ACCESS_KEY_ID":
			return store.AccessKeyID
		case "S3_SECRET_ACCESS_KEY":
			return store.SecretAccessKey
		default:
			return ""
		}
	}
	// The test reads the log only after run returns.
	var logOutput bytes.Buffer
	done := make(chan error, 1)
	go func() { done <- run(ctx, getenv, &logOutput) }()

	healthURL := "http://" + addr + "/v1/health"
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, healthURL, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	deadline := time.Now().Add(15 * time.Second)
	for {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			body, rerr := io.ReadAll(resp.Body)
			if cerr := resp.Body.Close(); cerr != nil {
				t.Fatalf("close response body: %v", cerr)
			}
			if rerr != nil {
				t.Fatalf("read response body: %v", rerr)
			}
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("GET %s: status = %d, want 200", healthURL, resp.StatusCode)
			}
			validateResponse(t, req, resp.StatusCode, resp.Header, body)
			break
		}
		select {
		case runErr := <-done:
			t.Fatalf("run ended before the server answered: %v", runErr)
		default:
		}
		if time.Now().After(deadline) {
			t.Fatalf("GET %s: no answer in 15 seconds: %v", healthURL, err)
		}
		time.Sleep(50 * time.Millisecond)
	}

	// The server answered, so the migrations ran: the two extensions exist.
	conn, err := pgx.Connect(t.Context(), url)
	if err != nil {
		t.Fatalf("connect to the database: %v", err)
	}
	defer func() {
		if cerr := conn.Close(context.WithoutCancel(t.Context())); cerr != nil {
			t.Errorf("close connection: %v", cerr)
		}
	}()
	var count int
	query := "SELECT count(*) FROM pg_extension WHERE extname IN ('postgis', 'vector')"
	if err := conn.QueryRow(t.Context(), query).Scan(&count); err != nil {
		t.Fatalf("query extensions: %v", err)
	}
	if count != 2 {
		t.Errorf("found %d of the extensions postgis and vector, want 2", count)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Errorf("run after cancel: got %v, want nil", err)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("run did not return 15 seconds after the context was canceled")
	}
	// RN-67: o recálculo é executado na subida. The inference service of
	// this test does not respond: the API serves, and the log has the cause.
	if !strings.Contains(logOutput.String(), "recompute of the noseprint vectors stopped") {
		t.Errorf("the log has no line about the recompute of the vectors:\n%s", logOutput.String())
	}
}

func TestRunFailsWhenTheDatabaseDoesNotRespond(t *testing.T) {
	getenv := func(key string) string {
		switch key {
		case "HTTP_ADDR":
			return freeAddr(t)
		case "DATABASE_URL":
			// Port 1 has no server.
			return "postgres://user:password@127.0.0.1:1/database?sslmode=disable"
		case "FIREBASE_PROJECT_ID":
			return _emulatorProjectID
		case "S3_ENDPOINT":
			return "http://127.0.0.1:1"
		case "INFERENCE_URL":
			return "http://127.0.0.1:1"
		case "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY":
			return "value-for-the-test"
		default:
			return ""
		}
	}

	err := run(t.Context(), getenv, io.Discard)

	if err == nil {
		t.Fatal("run without a database: got nil error, want an error")
	}
}
