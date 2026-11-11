package alerts

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/alerts/alertsdb"
)

// The push status of a notification, as the database keeps it.
const (
	_pushSent    = "sent"
	_pushNotSent = "not_sent"
	_pushFailed  = "failed"
	_pushPending = "pending"
)

// PushMessage is a push notification for the devices of one owner.
type PushMessage struct {
	Title string
	Body  string
	// Data goes to the app with the message: the kind and the report.
	Data map[string]string
}

// PushResult is the answer of the push service for one message.
type PushResult struct {
	// Sent is the number of devices that got the message.
	Sent int
	// InvalidTokens are the tokens that the service refused for good.
	InvalidTokens []string
}

// Pusher sends a message to devices. An error means that the service did
// not answer: the job tries again later (RNF-02).
type Pusher interface {
	Send(ctx context.Context, tokens []string, message PushMessage) (PushResult, error)
}

type pushPayload struct {
	NotificationID string `json:"notificationId"`
}

// pushJob sends one notification by push (RF-26).
type pushJob struct {
	// pusher is nil when the API has no credential (RN-36).
	pusher Pusher
}

// run sends the notification of the payload to the active devices of its
// owner. It is safe to run two times: it sends only a pending notification.
func (j pushJob) run(ctx context.Context, tx pgx.Tx, payload json.RawMessage) error {
	var push pushPayload
	if err := json.Unmarshal(payload, &push); err != nil {
		return fmt.Errorf("decode the push: %w", err)
	}
	queries := alertsdb.New(tx)
	notification, err := queries.LockNotificationForPush(ctx, push.NotificationID)
	if err != nil {
		return fmt.Errorf("lock the notification of the push: %w", err)
	}
	if notification.PushStatus != _pushPending {
		return nil
	}
	tokens, err := queries.ListActiveDeviceTokens(ctx, notification.OwnerID)
	if err != nil {
		return fmt.Errorf("list the devices of the owner: %w", err)
	}
	status := func(value string) error {
		err := queries.SetPushStatus(ctx, alertsdb.SetPushStatusParams{
			ID: push.NotificationID, PushStatus: value,
		})
		if err != nil {
			return fmt.Errorf("set the push status: %w", err)
		}
		return nil
	}
	// RN-36: o push só é enviado com a credencial configurada. RN-35: a
	// notificação existe na lista mesmo quando o push não sai.
	if j.pusher == nil || len(tokens) == 0 {
		return status(_pushNotSent)
	}
	data := map[string]string{"kind": notification.Kind, "notificationId": push.NotificationID}
	if notification.ReportID != nil {
		data["reportId"] = *notification.ReportID
	}
	result, err := j.pusher.Send(ctx, tokens, PushMessage{
		Title: notification.Title, Body: notification.Body, Data: data,
	})
	if err != nil {
		return fmt.Errorf("send the push: %w", err)
	}
	// RN-36: um token que o Cloud Messaging recusa é desativado.
	if len(result.InvalidTokens) > 0 {
		if err := queries.DeactivateDevices(ctx, result.InvalidTokens); err != nil {
			return fmt.Errorf("deactivate the refused devices: %w", err)
		}
	}
	if result.Sent == 0 {
		return status(_pushFailed)
	}
	return status(_pushSent)
}
