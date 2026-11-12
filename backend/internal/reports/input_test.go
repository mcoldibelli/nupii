package reports

import (
	"errors"
	"math"
	"strings"
	"testing"
	"time"
)

func ptr[T any](v T) *T { return &v }

func TestCleanText(t *testing.T) {
	tests := []struct {
		name    string
		details Details
		want    Details
		wantErr string
	}{
		{name: "RN-70 no text", details: Details{}, want: Details{}},
		{
			name:    "RN-70 the spaces around the texts are removed, and an empty text has no value",
			details: Details{Place: ptr("  Praça da Sé "), Description: ptr("   ")},
			want:    Details{Place: ptr("Praça da Sé")},
		},
		{
			name:    "RN-70 place with 200 characters and description with 1000",
			details: Details{Place: ptr(strings.Repeat("é", 200)), Description: ptr(strings.Repeat("ã", 1000))},
			want:    Details{Place: ptr(strings.Repeat("é", 200)), Description: ptr(strings.Repeat("ã", 1000))},
		},
		{name: "RN-70 place with 201 characters",
			details: Details{Place: ptr(strings.Repeat("a", 201))}, wantErr: "place"},
		{name: "RN-70 description with 1001 characters",
			details: Details{Description: ptr(strings.Repeat("a", 1001))}, wantErr: "description"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.details.clean()
			if tt.wantErr != "" {
				validation, ok := errors.AsType[*ValidationError](err)
				if !ok || !strings.Contains(validation.Message, tt.wantErr) {
					t.Fatalf("error = %v, want a ValidationError about %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("clean: %v", err)
			}
			if !sameText(got.Place, tt.want.Place) || !sameText(got.Description, tt.want.Description) {
				t.Errorf("clean = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func sameText(a, b *string) bool {
	return (a == nil) == (b == nil) && (a == nil || *a == *b)
}

func TestValidPoint(t *testing.T) {
	tests := []struct {
		name  string
		point Point
		want  bool
	}{
		{name: "RN-70 a point of the Earth", point: Point{Latitude: -23.55, Longitude: -46.63}, want: true},
		{name: "RN-70 the limits", point: Point{Latitude: -90, Longitude: 180}, want: true},
		{name: "RN-70 latitude over 90", point: Point{Latitude: 90.1, Longitude: 0}},
		{name: "RN-70 longitude under -180", point: Point{Latitude: 0, Longitude: -180.1}},
		{name: "RN-70 latitude that is not a number", point: Point{Latitude: math.NaN(), Longitude: 0}},
	}
	for _, tt := range tests {
		if got := tt.point.valid(); got != tt.want {
			t.Errorf("%s: valid = %t, want %t", tt.name, got, tt.want)
		}
	}
}

func TestOccurredAt(t *testing.T) {
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)

	// RN-71: sem data, vale o momento do registro.
	if got, err := occurredAt(nil, now); err != nil || !got.Equal(now) {
		t.Errorf("no date: %v, %v, want %v", got, err, now)
	}
	earlier := now.Add(-2 * time.Hour)
	if got, err := occurredAt(&earlier, now); err != nil || !got.Equal(earlier) {
		t.Errorf("a date before now: %v, %v, want %v", got, err, earlier)
	}
	// RN-71: a data do desaparecimento não é futura.
	later := now.Add(time.Minute)
	if _, err := occurredAt(&later, now); err == nil {
		t.Error("a date in the future: no error")
	}
}

func TestResolveCode(t *testing.T) {
	code, hash, err := newResolveCode()
	if err != nil {
		t.Fatalf("newResolveCode: %v", err)
	}
	// RN-69: o código tem 256 bits. Base64 without padding gives 43 characters.
	if len(code) != 43 {
		t.Errorf("the code has %d characters, want 43 (256 bits)", len(code))
	}
	if string(hashCode(code)) != string(hash) {
		t.Error("the hash of the code is not the hash that is stored")
	}
	other, _, err := newResolveCode()
	if err != nil || other == code {
		t.Errorf("two codes are the same, or error %v", err)
	}
}
