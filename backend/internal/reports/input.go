package reports

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// RN-70: tamanhos máximos dos textos de uma ocorrência, em caracteres.
const (
	_maxPlaceLength       = 200
	_maxDescriptionLength = 1000
)

// ValidationError is the error for data that breaks a rule. Message says
// which rule.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Point is a place on the map, in degrees.
type Point struct {
	Latitude  float64
	Longitude float64
}

// valid tells if the point is a point of the Earth (RN-70).
func (p Point) valid() bool {
	// A value that is not a number (NaN) fails each comparison, so the
	// check says what is accepted.
	return p.Latitude >= -90 && p.Latitude <= 90 && p.Longitude >= -180 && p.Longitude <= 180
}

// Details are the texts of a report or of a sighting. Both are optional.
type Details struct {
	Place       *string
	Description *string
}

// clean applies RN-70 to the texts and returns them without the spaces
// around them. An empty text has no value.
//
// RN-70: o nome do local tem no máximo 200 caracteres, e o recado tem no
// máximo 1.000.
func (d Details) clean() (Details, error) {
	var err error
	if d.Place, err = cleanText(d.Place, "place", _maxPlaceLength); err != nil {
		return Details{}, err
	}
	d.Description, err = cleanText(d.Description, "description", _maxDescriptionLength)
	if err != nil {
		return Details{}, err
	}
	return d, nil
}

func cleanText(text *string, field string, maxLength int) (*string, error) {
	if text == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*text)
	if trimmed == "" {
		return nil, nil
	}
	if utf8.RuneCountInString(trimmed) > maxLength {
		return nil, &ValidationError{
			Message: fmt.Sprintf("%s must have at most %d characters", field, maxLength),
		}
	}
	return &trimmed, nil
}

// occurredAt returns the time of a lost report: date, or now when date is
// nil. It returns a ValidationError for a date after now.
//
// RN-71: a data do desaparecimento é opcional e não é futura.
func occurredAt(date *time.Time, now time.Time) (time.Time, error) {
	if date == nil {
		return now, nil
	}
	if date.After(now) {
		return time.Time{}, &ValidationError{Message: "occurredAt must not be in the future"}
	}
	return *date, nil
}

// newResolveCode returns a new code for a found report, and the hash of the
// code that the database keeps.
//
// RN-69: o código tem 256 bits, e só o SHA-256 dele vai para o banco.
func newResolveCode() (code string, hash []byte, err error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", nil, fmt.Errorf("make the resolve code: %w", err)
	}
	code = base64.RawURLEncoding.EncodeToString(random)
	return code, hashCode(code), nil
}

// hashCode returns the hash of a resolve code.
func hashCode(code string) []byte {
	sum := sha256.Sum256([]byte(code))
	return sum[:]
}
