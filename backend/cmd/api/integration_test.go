//go:build integration

package main

import (
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// databaseURL returns the address of the Postgres of the local environment.
// An integration test without a database fails. It is not skipped.
func databaseURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL is not set: start the compose and set the variable (see backend/README.md)")
	}
	return url
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
	url := databaseURL(t)
	addr := freeAddr(t)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	getenv := func(key string) string {
		switch key {
		case "HTTP_ADDR":
			return addr
		case "DATABASE_URL":
			return url
		default:
			return ""
		}
	}
	done := make(chan error, 1)
	go func() { done <- run(ctx, getenv, io.Discard) }()

	healthURL := "http://" + addr + "/v1/health"
	deadline := time.Now().Add(15 * time.Second)
	for {
		resp, err := http.Get(healthURL)
		if err == nil {
			if cerr := resp.Body.Close(); cerr != nil {
				t.Fatalf("close response body: %v", cerr)
			}
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("GET %s: status = %d, want 200", healthURL, resp.StatusCode)
			}
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
}

func TestRunFailsWhenTheDatabaseDoesNotRespond(t *testing.T) {
	getenv := func(key string) string {
		switch key {
		case "HTTP_ADDR":
			return freeAddr(t)
		case "DATABASE_URL":
			// Port 1 has no server.
			return "postgres://user:password@127.0.0.1:1/database?sslmode=disable"
		default:
			return ""
		}
	}

	err := run(t.Context(), getenv, io.Discard)

	if err == nil {
		t.Fatal("run without a database: got nil error, want an error")
	}
}
