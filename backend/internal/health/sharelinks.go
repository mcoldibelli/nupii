package health

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/health/healthdb"
)

const (
	// _tokenBytes is the size of the token of a share link.
	//
	// RN-39: o link usa um token de 256 bits.
	_tokenBytes = 32
	// _photoURLExpiry is the validity of the URL of the photo of the card (RN-06).
	_photoURLExpiry = 15 * time.Minute
)

// ErrShareLinkNotFound is returned when the share link does not exist, or
// when it does not open (RN-41).
var ErrShareLinkNotFound = errors.New("share link not found")

// ShareLink is a link of the health card of a pet. Token has a value only
// in the answer of the creation (RN-39).
type ShareLink struct {
	ID        string
	Token     string
	ExpiresAt time.Time
	Opens     int
	CreatedAt time.Time
}

// Card is the health card that a share link opens (RN-83).
type Card struct {
	Pet             healthdb.OpenShareLinkRow
	PhotoURL        string
	Vaccines        []healthdb.ListCardVaccinesRow
	ParasiteControl []healthdb.ListCardParasiteControlRow
}

// hashToken returns the SHA-256 of the token, the value that the database
// keeps (RN-39).
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

// CreateShareLink creates a share link of the pet petID (RF-30).
func (s *Service) CreateShareLink(ctx context.Context, petID string) (ShareLink, error) {
	if err := s.checkPet(ctx, petID); err != nil {
		return ShareLink{}, err
	}
	random := make([]byte, _tokenBytes)
	if _, err := rand.Read(random); err != nil {
		return ShareLink{}, fmt.Errorf("make the token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(random)
	row, err := s.queries.CreateShareLink(ctx, healthdb.CreateShareLinkParams{
		PetID: petID, TokenHash: hashToken(token),
	})
	if err != nil {
		return ShareLink{}, fmt.Errorf("create share link: %w", err)
	}
	return ShareLink{
		ID: row.ID, Token: token, ExpiresAt: row.ExpiresAt,
		Opens: int(row.Opens), CreatedAt: row.CreatedAt,
	}, nil
}

// ShareLinks returns the active share links of the pet petID, from the
// newest to the oldest (RN-40).
func (s *Service) ShareLinks(ctx context.Context, petID string) ([]ShareLink, error) {
	if err := s.checkPet(ctx, petID); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListShareLinks(ctx, petID)
	if err != nil {
		return nil, fmt.Errorf("list share links: %w", err)
	}
	links := make([]ShareLink, 0, len(rows))
	for _, row := range rows {
		links = append(links, ShareLink{
			ID: row.ID, ExpiresAt: row.ExpiresAt, Opens: int(row.Opens), CreatedAt: row.CreatedAt,
		})
	}
	return links, nil
}

// RevokeShareLink revokes the share link linkID of the pet petID. A link
// that is already revoked stays revoked.
func (s *Service) RevokeShareLink(ctx context.Context, petID, linkID string) error {
	if err := s.checkPet(ctx, petID); err != nil {
		return err
	}
	revoked, err := s.queries.RevokeShareLink(ctx, healthdb.RevokeShareLinkParams{
		ID: linkID, PetID: petID,
	})
	if err != nil {
		return fmt.Errorf("revoke share link: %w", err)
	}
	if revoked == 0 {
		return ErrShareLinkNotFound
	}
	return nil
}

// OpenCard returns the health card of the share link of the token, and
// counts the open (RF-31). The caller needs no account.
func (s *Service) OpenCard(ctx context.Context, token string) (Card, error) {
	pet, err := s.queries.OpenShareLink(ctx, hashToken(token))
	if errors.Is(err, pgx.ErrNoRows) {
		return Card{}, ErrShareLinkNotFound
	}
	if err != nil {
		return Card{}, fmt.Errorf("open share link: %w", err)
	}
	card := Card{Pet: pet}
	if pet.PhotoKey != nil {
		card.PhotoURL, err = s.photos.SignedURL(*pet.PhotoKey, _photoURLExpiry)
		if err != nil {
			return Card{}, fmt.Errorf("sign the photo URL of the pet %s: %w", pet.PetID, err)
		}
	}
	card.Vaccines, err = s.queries.ListCardVaccines(ctx, pet.PetID)
	if err != nil {
		return Card{}, fmt.Errorf("list the vaccines of the card: %w", err)
	}
	card.ParasiteControl, err = s.queries.ListCardParasiteControl(ctx, pet.PetID)
	if err != nil {
		return Card{}, fmt.Errorf("list the parasite control of the card: %w", err)
	}
	return card, nil
}
