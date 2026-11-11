package identity

import (
	"errors"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/mcoldibelli/nupii/backend/internal/api"
)

func TestValidateRegistration(t *testing.T) {
	tests := []struct {
		name         string
		ownerName    string
		termsVersion string
		wantName     string
		wantErr      error
	}{
		{name: "valid", ownerName: "Ana", termsVersion: CurrentTermsVersion, wantName: "Ana"},
		{name: "spaces around the name are removed", ownerName: "  Ana Lima ", termsVersion: CurrentTermsVersion, wantName: "Ana Lima"},
		{name: "name with 100 characters", ownerName: strings.Repeat("á", 100), termsVersion: CurrentTermsVersion, wantName: strings.Repeat("á", 100)},
		// RN-45: o nome do tutor é obrigatório e tem no máximo 100 caracteres.
		{name: "RN-45 empty name", ownerName: "", termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		{name: "RN-45 name with only spaces", ownerName: "   ", termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		{name: "RN-45 name with 101 characters", ownerName: strings.Repeat("á", 101), termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		// RN-01: o tutor só é registrado com o aceite da versão vigente dos termos.
		{name: "RN-01 version that is not the current one", ownerName: "Ana", termsVersion: "another-version", wantErr: ErrTermsVersion},
		{name: "RN-01 no terms version", ownerName: "Ana", termsVersion: "", wantErr: ErrTermsVersion},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateRegistration(tt.ownerName, tt.termsVersion)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("error = %v, want %v", err, tt.wantErr)
			}
			if got != tt.wantName {
				t.Errorf("name = %q, want %q", got, tt.wantName)
			}
		})
	}
}

// The contract and the service must have the same current terms version.
func TestCurrentTermsVersionIsInTheContract(t *testing.T) {
	if !api.TermsVersion(CurrentTermsVersion).Valid() {
		t.Errorf("CurrentTermsVersion %q is not a value of the schema TermsVersion of the contract", CurrentTermsVersion)
	}
}

// The contract and the service must have the same limit for the name.
func TestMaxNameLengthIsInTheContract(t *testing.T) {
	doc, err := openapi3.NewLoader().LoadFromFile("../../../api/openapi.yaml")
	if err != nil {
		t.Fatalf("load contract: %v", err)
	}
	name := doc.Components.Schemas["RegisterOwnerRequest"].Value.Properties["name"].Value
	if name.MaxLength == nil || *name.MaxLength != _maxNameLength {
		t.Errorf("maxLength of RegisterOwnerRequest.name in the contract = %v, want %d", name.MaxLength, _maxNameLength)
	}
}
