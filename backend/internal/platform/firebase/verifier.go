// Package firebase validates the ID tokens of Firebase Authentication with
// the Firebase Admin SDK.
package firebase

import (
	"context"
	"errors"
	"fmt"

	firebasesdk "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
)

// ErrInvalidToken is the error for a token that is malformed, expired, not
// from this project, or without an e-mail.
var ErrInvalidToken = errors.New("firebase: invalid ID token")

// Token has the data that the API uses from a valid ID token.
type Token struct {
	// UID is the identifier of the user in Firebase Authentication.
	UID string
	// Email is the e-mail of the user.
	Email string
}

// Verifier validates ID tokens of one Firebase project.
type Verifier struct {
	client *auth.Client
}

// NewVerifier returns a Verifier for the project projectID.
//
// The Admin SDK reads the environment: with FIREBASE_AUTH_EMULATOR_HOST it
// uses the Authentication emulator and does not check the signature of the
// tokens. Without that variable it needs a credential of the project.
func NewVerifier(ctx context.Context, projectID string) (*Verifier, error) {
	app, err := firebasesdk.NewApp(ctx, &firebasesdk.Config{ProjectID: projectID})
	if err != nil {
		return nil, fmt.Errorf("create firebase app: %w", err)
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("create firebase auth client: %w", err)
	}
	return &Verifier{client: client}, nil
}

// VerifyIDToken validates rawToken. For a token that is not valid, it
// returns an error that wraps ErrInvalidToken. Any other error means that
// the validation could not be done.
func (v *Verifier) VerifyIDToken(ctx context.Context, rawToken string) (Token, error) {
	token, err := v.client.VerifyIDToken(ctx, rawToken)
	if auth.IsCertificateFetchFailed(err) {
		return Token{}, fmt.Errorf("fetch the public keys of firebase: %w", err)
	}
	if err != nil {
		return Token{}, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	email, ok := token.Claims["email"].(string)
	if !ok || email == "" {
		return Token{}, fmt.Errorf("%w: the token has no e-mail", ErrInvalidToken)
	}
	return Token{UID: token.UID, Email: email}, nil
}
