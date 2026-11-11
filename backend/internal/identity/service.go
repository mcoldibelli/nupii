package identity

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/mcoldibelli/nupii/backend/internal/identity/identitydb"
)

// CurrentTermsVersion is the version of the terms of use that an owner
// accepts today. The contract has the same value in the schema TermsVersion.
const CurrentTermsVersion = "2026-11-10"

// _maxNameLength is the maximum length of the name of an owner, in
// characters. The contract has the same value.
const _maxNameLength = 100

var (
	// ErrOwnerNotFound means that the account did not register an owner yet.
	ErrOwnerNotFound = errors.New("owner not found")
	// ErrInvalidName means that the name of the owner is empty or too long.
	ErrInvalidName = errors.New("invalid owner name")
	// ErrTermsVersion means that the accepted version of the terms of use
	// is not the current version.
	ErrTermsVersion = errors.New("accepted terms version is not the current version")
)

// Owner is the tutor: a person with an account, responsible for pets.
type Owner struct {
	ID              string
	Name            string
	Email           string
	TermsVersion    string
	TermsAcceptedAt time.Time
}

// Service has the rules of the owner.
type Service struct {
	queries *identitydb.Queries
	now     func() time.Time
}

// NewService returns a Service that reads and writes with db. The function
// now gives the time of the acceptance of the terms.
func NewService(db identitydb.DBTX, now func() time.Time) *Service {
	return &Service{queries: identitydb.New(db), now: now}
}

// Register creates the owner of the account who, with the name and the
// acceptance of the terms of use. When the account already has an owner,
// Register changes nothing and returns that owner with created false.
func (s *Service) Register(
	ctx context.Context,
	who Identity,
	name string,
	acceptedTermsVersion string,
) (owner Owner, created bool, err error) {
	name, err = validateRegistration(name, acceptedTermsVersion)
	if err != nil {
		return Owner{}, false, err
	}
	row, err := s.queries.CreateOwner(ctx, identitydb.CreateOwnerParams{
		FirebaseUID:     who.UID,
		Email:           who.Email,
		Name:            name,
		TermsVersion:    acceptedTermsVersion,
		TermsAcceptedAt: s.now(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// The insert changed nothing: the account already has an owner.
		owner, err = s.Owner(ctx, who)
		return owner, false, err
	}
	if err != nil {
		return Owner{}, false, fmt.Errorf("create owner: %w", err)
	}
	return ownerFromRow(row), true, nil
}

// Owner returns the owner of the account who. It returns ErrOwnerNotFound
// when the account did not register an owner.
func (s *Service) Owner(ctx context.Context, who Identity) (Owner, error) {
	row, err := s.queries.GetOwnerByFirebaseUID(ctx, who.UID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Owner{}, ErrOwnerNotFound
	}
	if err != nil {
		return Owner{}, fmt.Errorf("get owner: %w", err)
	}
	return ownerFromRow(row), nil
}

// validateRegistration applies the rules of the registration and returns
// the name without the spaces around it.
func validateRegistration(name, acceptedTermsVersion string) (string, error) {
	// RN-45: the name of the owner is required.
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > _maxNameLength {
		return "", ErrInvalidName
	}
	// RN-01: the owner is registered only with the acceptance of the
	// current version of the terms of use.
	if acceptedTermsVersion != CurrentTermsVersion {
		return "", ErrTermsVersion
	}
	return name, nil
}

func ownerFromRow(row identitydb.Owner) Owner {
	return Owner{
		ID:              row.ID,
		Name:            row.Name,
		Email:           row.Email,
		TermsVersion:    row.TermsVersion,
		TermsAcceptedAt: row.TermsAcceptedAt,
	}
}
