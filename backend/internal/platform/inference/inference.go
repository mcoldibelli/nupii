// Package inference is the client of the inference service, which changes
// the photo of a nose into a vector.
package inference

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/mcoldibelli/nupii/backend/internal/platform/httpx"
)

// Dimensions is the number of values of a vector (RN-18).
const Dimensions = 512

const (
	// _timeout is the time that one call has. The service runs one
	// inference at a time, so a call can wait for other calls.
	_timeout = 30 * time.Second
	// _maxAnswerBytes is more than the size of an answer with a vector.
	_maxAnswerBytes = 1 << 20
)

// The errors of a call. ErrUnavailable is the only one that is a failure of
// the system. The others are refusals of the photo.
var (
	// ErrInvalidImage means that the service could not read the photo (RN-17).
	ErrInvalidImage = errors.New("the photo is not an image that can be read")
	// ErrLowQuality means that the photo is not sharp enough (RN-20).
	ErrLowQuality = errors.New("the photo is not sharp enough")
	// ErrFraming means that the detector found no nose in the photo (RN-21).
	ErrFraming = errors.New("the photo shows no nose")
	// ErrUnavailable means that the service did not answer, or gave an
	// answer that is not in its contract.
	ErrUnavailable = errors.New("the inference service is not available")
)

// Embedding is the answer of the service for one photo.
type Embedding struct {
	// Vector has Dimensions values and an L2 norm of 1.
	Vector []float32
	// ModelVersion is the label of the model that made the vector. Two
	// vectors are comparable only with the same label.
	ModelVersion string
	// Quality is the sharpness of the photo, from 0 to 1.
	Quality float64
}

// Client calls the inference service.
type Client struct {
	baseURL string
	http    *http.Client
}

// New returns a client of the service at baseURL.
func New(baseURL string) *Client {
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: _timeout}}
}

// Embed returns the vector of the nose in image. It returns
// ErrInvalidImage, ErrLowQuality or ErrFraming when the service refuses
// the photo, and ErrUnavailable when the service fails.
func (c *Client) Embed(ctx context.Context, image []byte) (Embedding, error) {
	var answer struct {
		Embedding    []float32 `json:"embedding"`
		ModelVersion string    `json:"modelVersion"`
		Quality      float64   `json:"quality"`
	}
	err := c.call(ctx, http.MethodPost, "/v1/nose/embedding", bytes.NewReader(image), &answer)
	if err != nil {
		return Embedding{}, err
	}
	if len(answer.Embedding) != Dimensions || answer.ModelVersion == "" {
		return Embedding{}, fmt.Errorf("%w: answer with %d dimensions and model version %q",
			ErrUnavailable, len(answer.Embedding), answer.ModelVersion)
	}
	return Embedding{
		Vector:       answer.Embedding,
		ModelVersion: answer.ModelVersion,
		Quality:      answer.Quality,
	}, nil
}

// ModelVersion returns the label of the model that the service has now.
func (c *Client) ModelVersion(ctx context.Context) (string, error) {
	var answer struct {
		ModelVersion string `json:"modelVersion"`
	}
	if err := c.call(ctx, http.MethodGet, "/v1/model-info", nil, &answer); err != nil {
		return "", err
	}
	if answer.ModelVersion == "" {
		return "", fmt.Errorf("%w: answer with no model version", ErrUnavailable)
	}
	return answer.ModelVersion, nil
}

// call sends one request and decodes the JSON of a 200 answer into answer.
func (c *Client) call(
	ctx context.Context,
	method, path string,
	body io.Reader,
	answer any,
) (err error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return fmt.Errorf("build %s %s: %w", method, path, err)
	}
	// RNF-07: the service writes this identifier in its log lines.
	if id := httpx.RequestID(ctx); id != "" {
		req.Header.Set(httpx.RequestIDHeader, id)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		// The caller ended the request: this is not a failure of the service.
		if ctxErr := ctx.Err(); ctxErr != nil {
			return fmt.Errorf("%s %s: %w", method, path, ctxErr)
		}
		return fmt.Errorf("%w: %s %s: %w", ErrUnavailable, method, path, err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil && err == nil {
			err = fmt.Errorf("close answer of %s %s: %w", method, path, cerr)
		}
	}()
	data, err := io.ReadAll(io.LimitReader(resp.Body, _maxAnswerBytes))
	if err != nil {
		return fmt.Errorf("%w: read answer of %s %s: %w", ErrUnavailable, method, path, err)
	}
	if resp.StatusCode != http.StatusOK {
		return refusal(resp.StatusCode, data)
	}
	if err := json.Unmarshal(data, answer); err != nil {
		return fmt.Errorf("%w: decode answer of %s %s: %w", ErrUnavailable, method, path, err)
	}
	return nil
}

// refusal returns the error for an answer that is not 200.
func refusal(status int, data []byte) error {
	var body struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		return fmt.Errorf("%w: status %d with an answer that is not JSON: %w",
			ErrUnavailable, status, err)
	}
	switch body.Error {
	case "image_invalid", "image_too_large":
		return ErrInvalidImage
	case "image_low_quality":
		return ErrLowQuality
	case "image_framing":
		return ErrFraming
	default:
		return fmt.Errorf("%w: status %d with code %q", ErrUnavailable, status, body.Error)
	}
}
