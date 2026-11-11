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
	// ErrNoIdentity means that the request has no identity in the context:
	// the operation ran without RequireIdentity. It is a wiring error, so
	// the client gets the internal error.
	ErrNoIdentity = errors.New("the request has no identity in the context")
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
}

// NewService returns a Service that reads and writes with db.
func NewService(db identitydb.DBTX) *Service {
	return &Service{queries: identitydb.New(db)}
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
		TermsAcceptedAt: time.Now(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// The insert changed nothing: the account already has an owner.
		owner, err = s.Owner(ctx, who)
		if err != nil {
			return Owner{}, false, fmt.Errorf("read the owner that already exists: %w", err)
		}
		return owner, false, nil
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

// IsDeleted tells if the account of the user uid is deleted (RN-04).
func (s *Service) IsDeleted(ctx context.Context, uid string) (bool, error) {
	deleted, err := s.queries.IsOwnerDeleted(ctx, uid)
	if err != nil {
		return false, fmt.Errorf("read if the owner is deleted: %w", err)
	}
	return deleted, nil
}

// CurrentOwner returns the owner of the account that made the request of
// ctx. It returns ErrOwnerNotFound when the account did not register an
// owner. The other modules use this method to find who makes a request.
func (s *Service) CurrentOwner(ctx context.Context) (Owner, error) {
	who, ok := FromContext(ctx)
	if !ok {
		return Owner{}, ErrNoIdentity
	}
	return s.Owner(ctx, who)
}

// validateRegistration applies the rules of the registration and returns
// the name without the spaces around it.
func validateRegistration(name, acceptedTermsVersion string) (string, error) {
	// RN-45: o nome do tutor é obrigatório e tem no máximo 100 caracteres.
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > _maxNameLength {
		return "", ErrInvalidName
	}
	// RN-01: o tutor só é registrado com o aceite da versão vigente dos
	// termos de uso.
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
