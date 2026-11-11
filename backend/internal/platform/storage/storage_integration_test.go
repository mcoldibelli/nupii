//go:build integration

package storage_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/platform/storage"
	"github.com/mcoldibelli/nupii/backend/internal/platform/storage/storagetest"
)

// fetch reads url with no credential and returns the status, the content
// type and the body.
func fetch(t *testing.T, url string) (status int, contentType string, body []byte) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("read the signed URL: %v", err)
	}
	body, rerr := io.ReadAll(resp.Body)
	if cerr := resp.Body.Close(); cerr != nil {
		t.Fatalf("close answer: %v", cerr)
	}
	if rerr != nil {
		t.Fatalf("read answer: %v", rerr)
	}
	return resp.StatusCode, resp.Header.Get("Content-Type"), body
}

func TestPutSignedURLAndDelete(t *testing.T) {
	ctx := t.Context()
	store := storage.New(storagetest.Config(t))
	// The key has characters that the signature escapes in its own way.
	key := "test/" + rand.Text() + "/a b ç +=@,$&;:100%.jpg"
	content := []byte("the content of the object " + rand.Text())
	t.Cleanup(func() {
		if err := store.Delete(context.WithoutCancel(ctx), key); err != nil {
			t.Errorf("delete the object of the test: %v", err)
		}
	})

	if err := store.Put(ctx, key, "image/jpeg", bytes.NewReader(content), int64(len(content))); err != nil {
		t.Fatalf("Put: %v", err)
	}

	// RN-06: a API devolve uma URL temporária que lê o objeto.
	signed, err := store.SignedURL(key, 15*time.Minute)
	if err != nil {
		t.Fatalf("SignedURL: %v", err)
	}
	status, contentType, body := fetch(t, signed)
	if status != http.StatusOK || contentType != "image/jpeg" || !bytes.Equal(body, content) {
		t.Errorf("read of the signed URL: status %d, content type %q, %d bytes, want 200, image/jpeg and the %d bytes written",
			status, contentType, len(body), len(content))
	}

	// The server checks the signature: a changed signature does not read.
	if status, _, _ := fetch(t, signed[:len(signed)-1]+"0"); status != http.StatusForbidden {
		if status, _, _ := fetch(t, signed[:len(signed)-1]+"1"); status != http.StatusForbidden {
			t.Errorf("read with a changed signature: status %d, want 403", status)
		}
	}

	if err := store.Delete(ctx, key); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if status, _, _ := fetch(t, signed); status != http.StatusNotFound {
		t.Errorf("read after the delete: status %d, want 404", status)
	}
	if err := store.Delete(ctx, key); err != nil {
		t.Errorf("Delete of an object that does not exist: %v, want nil", err)
	}
}

func TestPutFailsWithAWrongSecret(t *testing.T) {
	cfg := storagetest.Config(t)
	cfg.SecretAccessKey = "wrong-" + rand.Text()
	store := storage.New(cfg)

	err := store.Put(t.Context(), "test/"+rand.Text(), "text/plain", bytes.NewReader([]byte("x")), 1)

	if err == nil {
		t.Fatal("Put with a wrong secret: got nil error, want an error")
	}
	if bytes.Contains([]byte(err.Error()), []byte(cfg.SecretAccessKey)) || bytes.Contains([]byte(err.Error()), []byte("X-Amz-Signature")) {
		t.Errorf("the error has the secret or the signature: %v", err)
	}
}

// ADR 0020: o backend lê o conteúdo de um objeto.
func TestGet(t *testing.T) {
	ctx := t.Context()
	store := storage.New(storagetest.Config(t))
	key := "test/" + rand.Text() + "/photo of a nose.jpg"
	content := []byte("the content of the object " + rand.Text())
	t.Cleanup(func() {
		if err := store.Delete(context.WithoutCancel(ctx), key); err != nil {
			t.Errorf("delete the object of the test: %v", err)
		}
	})
	if err := store.Put(ctx, key, "image/jpeg", bytes.NewReader(content), int64(len(content))); err != nil {
		t.Fatalf("Put: %v", err)
	}

	got, err := store.Get(ctx, key, int64(len(content)))
	if err != nil || !bytes.Equal(got, content) {
		t.Errorf("Get = %d bytes, %v, want the %d bytes stored", len(got), err, len(content))
	}

	if _, err := store.Get(ctx, key, int64(len(content))-1); err == nil {
		t.Error("Get of an object larger than the limit: no error")
	}
	if _, err := store.Get(ctx, "test/"+rand.Text()+"/no object.jpg", 1024); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("Get of an object that does not exist: error = %v, want ErrNotFound", err)
	}
}
