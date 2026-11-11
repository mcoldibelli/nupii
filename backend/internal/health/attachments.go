package health

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/health/healthdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/imagefile"
)

const (
	// RN-82: um anexo tem até 10 MB (10 × 1.048.576 bytes).
	_maxAttachmentBytes = 10 << 20
	// RN-82: um evento tem no máximo 10 anexos.
	_maxAttachments = 10
	// RN-06: a URL temporária de um arquivo vale por 15 minutos.
	_attachmentURLExpiry = 15 * time.Minute
	// _maxFileNameLength is the length of the name of a file that the API keeps.
	_maxFileNameLength = 120
	_pdfType           = "application/pdf"
)

// ErrAttachmentLimit means that the event already has 10 attachments (RN-82).
var ErrAttachmentLimit = errors.New("the health event has the maximum of attachments")

// Attachment is a file of a health event.
type Attachment struct {
	ID string
	// URL is a temporary URL of the file.
	URL         string
	ContentType string
	FileName    string
	SizeBytes   int32
	CreatedAt   time.Time
}

// PhotoStore keeps the files. *storage.Store implements it.
type PhotoStore interface {
	Put(ctx context.Context, key, contentType string, body io.Reader, size int64) error
	Delete(ctx context.Context, key string) error
	SignedURL(key string, expires time.Duration) (string, error)
}

// checkAttachment applies RN-82 and returns the content type and the file
// extension of the file.
//
// RN-82: um anexo é uma imagem JPEG, PNG ou WebP, ou um PDF, com até 10 MB.
func checkAttachment(data []byte) (contentType, extension string, err error) {
	if len(data) > _maxAttachmentBytes {
		return "", "", &ValidationError{Message: "the file must have at most 10 MB"}
	}
	if contentType, extension, ok := imagefile.Type(data); ok {
		return contentType, extension, nil
	}
	// The type comes from the bytes of the file, not from what the client says.
	if http.DetectContentType(data) == _pdfType {
		return _pdfType, "pdf", nil
	}
	return "", "", &ValidationError{
		Message: "the file must be a JPEG, PNG or WebP image, or a PDF",
	}
}

// fileName returns the name of an uploaded file without its directories,
// with at most 120 characters, or "anexo" when it has none.
func fileName(name string) string {
	name = strings.TrimSpace(strings.ReplaceAll(name, `\`, "/"))
	name = strings.TrimSpace(path.Base(name))
	if name == "" || name == "." || name == "/" {
		return "anexo"
	}
	if utf8.RuneCountInString(name) > _maxFileNameLength {
		name = string([]rune(name)[:_maxFileNameLength])
	}
	return name
}

// checkEvent returns ErrEventNotFound when the event is not of the pet, and
// pets.ErrPetNotFound when the pet is not of the owner.
func (s *Service) checkEvent(ctx context.Context, petID, eventID string) error {
	if err := s.checkPet(ctx, petID); err != nil {
		return err
	}
	exists, err := s.queries.HealthEventExists(ctx, healthdb.HealthEventExistsParams{
		ID: eventID, PetID: petID,
	})
	if err != nil {
		return fmt.Errorf("find the health event: %w", err)
	}
	if !exists {
		return ErrEventNotFound
	}
	return nil
}

// Attachments returns the files of the event eventID of the pet petID.
func (s *Service) Attachments(ctx context.Context, petID, eventID string) ([]Attachment, error) {
	if err := s.checkEvent(ctx, petID, eventID); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListHealthAttachments(ctx, healthdb.ListHealthAttachmentsParams{
		EventID: eventID, PetID: petID,
	})
	if err != nil {
		return nil, fmt.Errorf("list health attachments: %w", err)
	}
	attachments := make([]Attachment, 0, len(rows))
	for _, row := range rows {
		attachment, err := s.attachment(row)
		if err != nil {
			return nil, err
		}
		attachments = append(attachments, attachment)
	}
	return attachments, nil
}

// AddAttachment stores the file data as an attachment of the event eventID
// of the pet petID (RF-28). name is the name that the client gives.
func (s *Service) AddAttachment(
	ctx context.Context,
	petID, eventID, name string,
	data []byte,
) (Attachment, error) {
	contentType, extension, err := checkAttachment(data)
	if err != nil {
		return Attachment{}, err
	}
	if err := s.checkEvent(ctx, petID, eventID); err != nil {
		return Attachment{}, err
	}
	// The file goes to the store before the transaction, so the transaction
	// does not hold the lock of the event during a call to the store.
	key := "health/" + eventID + "/" + strings.ToLower(rand.Text()) + "." + extension
	err = s.photos.Put(ctx, key, contentType, bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Attachment{}, fmt.Errorf("store the attachment: %w", err)
	}
	var row healthdb.HealthAttachment
	err = s.inTx(ctx, func(tx pgx.Tx) error {
		queries := s.queries.WithTx(tx)
		event, err := queries.LockHealthEvent(ctx, healthdb.LockHealthEventParams{
			ID: eventID, PetID: petID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrEventNotFound
		}
		if err != nil {
			return fmt.Errorf("lock the health event: %w", err)
		}
		if event.Attachments >= _maxAttachments {
			return ErrAttachmentLimit
		}
		row, err = queries.CreateHealthAttachment(ctx, healthdb.CreateHealthAttachmentParams{
			EventID: eventID, Key: key, ContentType: contentType,
			// The file has at most 10 MB, so the size fits an int32.
			FileName: fileName(name), SizeBytes: int32(len(data)),
		})
		if err != nil {
			return fmt.Errorf("create health attachment: %w", err)
		}
		return nil
	})
	if err != nil {
		s.deleteObjects(ctx, []string{key})
		return Attachment{}, err
	}
	return s.attachment(row)
}

// DeleteAttachment deletes the attachment attachmentID of the event eventID.
func (s *Service) DeleteAttachment(
	ctx context.Context,
	petID, eventID, attachmentID string,
) error {
	if err := s.checkPet(ctx, petID); err != nil {
		return err
	}
	key, err := s.queries.DeleteHealthAttachment(ctx, healthdb.DeleteHealthAttachmentParams{
		ID: attachmentID, EventID: eventID, PetID: petID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrEventNotFound
	}
	if err != nil {
		return fmt.Errorf("delete health attachment: %w", err)
	}
	s.deleteObjects(ctx, []string{key})
	return nil
}

// deleteObjects deletes the objects from the store. A failure stays in the
// log: the objects are no longer used, and the request that made them
// unused must not fail because of it. The delete continues when the client
// ends the request.
func (s *Service) deleteObjects(ctx context.Context, keys []string) {
	for _, key := range keys {
		if err := s.photos.Delete(context.WithoutCancel(ctx), key); err != nil {
			s.logger.ErrorContext(ctx, "delete an attachment from the store",
				slog.String("key", key), slog.Any("error", err))
		}
	}
}

func (s *Service) attachment(row healthdb.HealthAttachment) (Attachment, error) {
	url, err := s.photos.SignedURL(row.Key, _attachmentURLExpiry)
	if err != nil {
		return Attachment{}, fmt.Errorf("sign the URL of the attachment: %w", err)
	}
	return Attachment{
		ID: row.ID, URL: url, ContentType: row.ContentType, FileName: row.FileName,
		SizeBytes: row.SizeBytes, CreatedAt: row.CreatedAt,
	}, nil
}

// inTx runs work in a transaction, and commits when work returns nil.
func (s *Service) inTx(ctx context.Context, work func(tx pgx.Tx) error) (err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin the health transaction: %w", err)
	}
	defer func() {
		// After Commit, Rollback returns pgx.ErrTxClosed and does nothing.
		rerr := tx.Rollback(context.WithoutCancel(ctx))
		if rerr != nil && !errors.Is(rerr, pgx.ErrTxClosed) && err == nil {
			err = fmt.Errorf("roll back the health transaction: %w", rerr)
		}
	}()
	if err := work(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit the health transaction: %w", err)
	}
	return nil
}
