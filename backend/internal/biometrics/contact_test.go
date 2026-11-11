package biometrics

import (
	"errors"
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestValidateContact(t *testing.T) {
	valid := Contact{Name: "Bia Souza", Phone: "(11) 99999-0000"}
	tests := []struct {
		name    string
		contact Contact
		want    Contact
		wantErr string
	}{
		{name: "RN-63 name and phone", contact: valid, want: valid},
		{
			name:    "RN-63 the spaces around the texts are removed, and an empty message has no value",
			contact: Contact{Name: "  Bia ", Phone: " +55 11 99999-0000 ", Message: ptr("   ")},
			want:    Contact{Name: "Bia", Phone: "+55 11 99999-0000"},
		},
		{
			name:    "RN-63 message with 500 characters",
			contact: Contact{Name: "Bia", Phone: "12345678", Message: ptr(strings.Repeat("ç", 500))},
			want:    Contact{Name: "Bia", Phone: "12345678", Message: ptr(strings.Repeat("ç", 500))},
		},
		{name: "RN-63 name with 120 characters",
			contact: Contact{Name: strings.Repeat("ã", 120), Phone: "12345678"},
			want:    Contact{Name: strings.Repeat("ã", 120), Phone: "12345678"}},
		{name: "RN-63 no name", contact: Contact{Name: "  ", Phone: "12345678"}, wantErr: "name"},
		{name: "RN-63 name with 121 characters",
			contact: Contact{Name: strings.Repeat("a", 121), Phone: "12345678"}, wantErr: "name"},
		{name: "RN-63 no phone", contact: Contact{Name: "Bia"}, wantErr: "phone"},
		{name: "RN-63 phone with 7 characters", contact: Contact{Name: "Bia", Phone: "1234567"}, wantErr: "phone"},
		{name: "RN-63 phone with 31 characters",
			contact: Contact{Name: "Bia", Phone: strings.Repeat("1", 31)}, wantErr: "phone"},
		{name: "RN-63 phone with a letter", contact: Contact{Name: "Bia", Phone: "1234567a"}, wantErr: "phone"},
		{name: "RN-63 message with 501 characters",
			contact: Contact{Name: "Bia", Phone: "12345678", Message: ptr(strings.Repeat("a", 501))},
			wantErr: "message"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateContact(tt.contact)
			if tt.wantErr != "" {
				validation, ok := errors.AsType[*ValidationError](err)
				if !ok || !strings.Contains(validation.Message, tt.wantErr) {
					t.Fatalf("error = %v, want a ValidationError about %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateContact: %v", err)
			}
			sameMessage := (got.Message == nil) == (tt.want.Message == nil) &&
				(got.Message == nil || *got.Message == *tt.want.Message)
			if got.Name != tt.want.Name || got.Phone != tt.want.Phone || !sameMessage {
				t.Errorf("contact = %+v, want %+v", got, tt.want)
			}
		})
	}
}
