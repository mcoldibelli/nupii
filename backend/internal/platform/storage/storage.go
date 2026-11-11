// Package storage reads and writes objects in an S3-compatible object
// store. It uses presigned URLs (AWS Signature Version 4 in the query
// string), made with the standard library.
package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// _requestExpiry is the validity of the URLs that the Store uses for
	// its own requests.
	_requestExpiry = time.Minute
	// _requestTimeout is the time one request of the Store can take.
	_requestTimeout = 30 * time.Second
)

// Config is the configuration of a Store.
type Config struct {
	// Endpoint is the address that the API uses to reach the store.
	Endpoint string
	// PublicEndpoint is the address that the clients of the API use to
	// reach the store. The URLs of SignedURL have this address.
	PublicEndpoint string
	Bucket         string
	Region         string
	AccessKeyID    string
	// SecretAccessKey is a secret. It must not be written to the log.
	SecretAccessKey string
}

// Store is one bucket of an S3-compatible object store.
type Store struct {
	cfg    Config
	client *http.Client
}

// New returns a Store for the bucket of cfg.
func New(cfg Config) *Store {
	return &Store{cfg: cfg, client: &http.Client{Timeout: _requestTimeout}}
}

// Put writes body as the object key, with the content type.
func (s *Store) Put(
	ctx context.Context,
	key, contentType string,
	body io.Reader,
	size int64,
) error {
	signed, err := s.presign(http.MethodPut, s.cfg.Endpoint, key, time.Now(), _requestExpiry)
	if err != nil {
		return fmt.Errorf("sign put of %q: %w", key, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, signed, body)
	if err != nil {
		return fmt.Errorf("build put of %q: %w", key, err)
	}
	req.ContentLength = size
	req.Header.Set("Content-Type", contentType)
	return s.do(req, key, http.StatusOK)
}

// Delete deletes the object key. It returns nil when the object does not
// exist.
func (s *Store) Delete(ctx context.Context, key string) error {
	signed, err := s.presign(http.MethodDelete, s.cfg.Endpoint, key, time.Now(), _requestExpiry)
	if err != nil {
		return fmt.Errorf("sign delete of %q: %w", key, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, signed, nil)
	if err != nil {
		return fmt.Errorf("build delete of %q: %w", key, err)
	}
	return s.do(req, key, http.StatusNoContent)
}

// SignedURL returns a URL that reads the object key with no credential,
// until expires passes. The URL has the public address of the store.
func (s *Store) SignedURL(key string, expires time.Duration) (string, error) {
	signed, err := s.presign(http.MethodGet, s.cfg.PublicEndpoint, key, time.Now(), expires)
	if err != nil {
		return "", fmt.Errorf("sign read of %q: %w", key, err)
	}
	return signed, nil
}

// do sends req and checks the status of the answer.
func (s *Store) do(req *http.Request, key string, want int) (err error) {
	resp, err := s.client.Do(req)
	if err != nil {
		// The error of the client has the URL with the signature. Only its
		// cause is wrapped.
		if urlErr, ok := errors.AsType[*url.Error](err); ok {
			err = urlErr.Err
		}
		return fmt.Errorf("%s object %q: %w", req.Method, key, err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil && err == nil {
			err = fmt.Errorf("close answer of %s object %q: %w", req.Method, key, cerr)
		}
	}()
	if resp.StatusCode != want {
		return fmt.Errorf("%s object %q: status %d", req.Method, key, resp.StatusCode)
	}
	return nil
}

// presign returns the URL of the object key at endpoint, with the query
// parameters of an AWS Signature Version 4 presigned request for method.
// The URL is valid from now until expires passes.
func (s *Store) presign(
	method, endpoint, key string,
	now time.Time,
	expires time.Duration,
) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parse endpoint: %w", err)
	}
	// Path style: the bucket is the first part of the path. The path always
	// starts with "/". The request must send the path with the same escapes
	// that the signature uses, so the escaped form is set as RawPath.
	u.Path = strings.TrimSuffix(u.Path, "/") + "/" + s.cfg.Bucket + "/" + key
	u.RawPath = escapePath(u.Path)

	date := now.UTC().Format("20060102")
	timestamp := now.UTC().Format("20060102T150405Z")
	scope := date + "/" + s.cfg.Region + "/s3/aws4_request"
	query := url.Values{
		"X-Amz-Algorithm":     {"AWS4-HMAC-SHA256"},
		"X-Amz-Credential":    {s.cfg.AccessKeyID + "/" + scope},
		"X-Amz-Date":          {timestamp},
		"X-Amz-Expires":       {strconv.Itoa(int(expires.Seconds()))},
		"X-Amz-SignedHeaders": {"host"},
	}
	// Encode sorts the keys and escapes the values as the signature needs.
	// The only difference is the space, and these values have no space.
	canonicalQuery := strings.ReplaceAll(query.Encode(), "+", "%20")
	canonicalRequest := strings.Join([]string{
		method,
		u.RawPath,
		canonicalQuery,
		"host:" + u.Host + "\n",
		"host",
		"UNSIGNED-PAYLOAD",
	}, "\n")
	requestHash := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		timestamp,
		scope,
		hex.EncodeToString(requestHash[:]),
	}, "\n")

	signingKey := []byte("AWS4" + s.cfg.SecretAccessKey)
	for _, part := range []string{date, s.cfg.Region, "s3", "aws4_request"} {
		signingKey = hmacSHA256(signingKey, part)
	}
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))

	u.RawQuery = canonicalQuery + "&X-Amz-Signature=" + signature
	return u.String(), nil
}

// escapePath escapes a path as AWS Signature Version 4 needs: each byte is
// percent-encoded, except the letters, the digits, "-", "_", ".", "~" and
// the "/" between the parts. The escapes of net/url keep more characters,
// for example "+" and "=".
func escapePath(path string) string {
	const hexDigits = "0123456789ABCDEF"
	var escaped strings.Builder
	for i := range len(path) {
		c := path[i]
		unreserved := c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' ||
			c == '-' || c == '_' || c == '.' || c == '~' || c == '/'
		if unreserved {
			escaped.WriteByte(c)
			continue
		}
		escaped.WriteByte('%')
		escaped.WriteByte(hexDigits[c>>4])
		escaped.WriteByte(hexDigits[c&0x0F])
	}
	return escaped.String()
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	// The Write of a hash never returns an error.
	mac.Write([]byte(data))
	return mac.Sum(nil)
}
