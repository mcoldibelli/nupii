package storage

import (
	"net/url"
	"strings"
	"testing"
	"time"
)

// _testValue is the access secret of the tests. No server accepts it.
const _testValue = "value-for-the-test"

func testStore() *Store {
	return New(Config{
		Endpoint:        "http://internal:8333",
		PublicEndpoint:  "https://files.example.com",
		Bucket:          "photos",
		Region:          "us-east-1",
		AccessKeyID:     "key-id",
		SecretAccessKey: _testValue,
	})
}

func TestSignedURLUsesThePublicEndpointAndThePathOfTheObject(t *testing.T) {
	signed, err := testStore().SignedURL("pets/a b/ç.jpg", 15*time.Minute)
	if err != nil {
		t.Fatalf("SignedURL: %v", err)
	}
	u, err := url.Parse(signed)
	if err != nil {
		t.Fatalf("parse %q: %v", signed, err)
	}
	if u.Scheme != "https" || u.Host != "files.example.com" {
		t.Errorf("address = %s://%s, want the public endpoint https://files.example.com", u.Scheme, u.Host)
	}
	if want := "/photos/pets/a%20b/%C3%A7.jpg"; u.EscapedPath() != want {
		t.Errorf("escaped path = %q, want %q", u.EscapedPath(), want)
	}
	query := u.Query()
	// RN-06: the temporary URL is valid for 15 minutes.
	if got := query.Get("X-Amz-Expires"); got != "900" {
		t.Errorf("X-Amz-Expires = %q, want 900", got)
	}
	if got := query.Get("X-Amz-Signature"); len(got) != 64 {
		t.Errorf("X-Amz-Signature = %q, want 64 hexadecimal characters", got)
	}
	if strings.Contains(signed, _testValue) {
		t.Error("the signed URL has the secret access key")
	}
}

func TestPresignChangesWithTheMethodTheKeyAndTheTime(t *testing.T) {
	store := testStore()
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	sign := func(method, key string, at time.Time) string {
		signed, err := store.presign(method, "http://internal:8333", key, at, time.Minute)
		if err != nil {
			t.Fatalf("presign: %v", err)
		}
		u, err := url.Parse(signed)
		if err != nil {
			t.Fatalf("parse %q: %v", signed, err)
		}
		return u.Query().Get("X-Amz-Signature")
	}
	base := sign("GET", "a.jpg", now)
	if base != sign("GET", "a.jpg", now) {
		t.Error("the same request gives two different signatures")
	}
	others := map[string]string{
		"another method": sign("PUT", "a.jpg", now),
		"another key":    sign("GET", "b.jpg", now),
		"another time":   sign("GET", "a.jpg", now.Add(time.Second)),
	}
	for name, signature := range others {
		if signature == base {
			t.Errorf("%s gives the same signature", name)
		}
	}
}

// The signed path always starts with "/". An endpoint with and without the
// final "/" is the same address, so the two signatures are the same.
func TestPresignSignsThePathWithTheLeadingSlash(t *testing.T) {
	store := testStore()
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	without, err := store.presign("PUT", "http://internal:8333", "a.jpg", now, time.Minute)
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	with, err := store.presign("PUT", "http://internal:8333/", "a.jpg", now, time.Minute)
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	if without != with {
		t.Errorf("the two URLs are different:\n%s\n%s", without, with)
	}
	if !strings.HasPrefix(without, "http://internal:8333/photos/a.jpg?") {
		t.Errorf("URL = %q, want the path /photos/a.jpg", without)
	}
}
