package firebase

import (
	"context"
	"fmt"

	firebasesdk "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
)

// Pusher sends push notifications with Firebase Cloud Messaging.
type Pusher struct {
	client *messaging.Client
}

// PushResult is the answer of Cloud Messaging for one message.
type PushResult struct {
	// Sent is the number of devices that got the message.
	Sent int
	// InvalidTokens are the tokens that Cloud Messaging refused for good:
	// the app was removed from the device.
	InvalidTokens []string
}

// NewPusher returns a Pusher for the project projectID. The Admin SDK reads
// the credential of the file in GOOGLE_APPLICATION_CREDENTIALS.
func NewPusher(ctx context.Context, projectID string) (*Pusher, error) {
	app, err := firebasesdk.NewApp(ctx, &firebasesdk.Config{ProjectID: projectID})
	if err != nil {
		return nil, fmt.Errorf("create firebase app: %w", err)
	}
	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("create firebase messaging client: %w", err)
	}
	return &Pusher{client: client}, nil
}

// Send sends the message to each token. An error means that Cloud
// Messaging did not answer.
func (p *Pusher) Send(
	ctx context.Context,
	tokens []string,
	title, body string,
	data map[string]string,
) (PushResult, error) {
	response, err := p.client.SendEachForMulticast(ctx, &messaging.MulticastMessage{
		Tokens:       tokens,
		Notification: &messaging.Notification{Title: title, Body: body},
		Data:         data,
	})
	if err != nil {
		return PushResult{}, fmt.Errorf("send the push: %w", err)
	}
	result := PushResult{Sent: response.SuccessCount}
	for i, answer := range response.Responses {
		// Only this error is about the token. An invalid argument can be an
		// error of the message, the same for all the tokens.
		if answer.Error != nil && messaging.IsUnregistered(answer.Error) {
			result.InvalidTokens = append(result.InvalidTokens, tokens[i])
		}
	}
	return result, nil
}
