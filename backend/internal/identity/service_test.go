package identity

import (
	"errors"
	"strings"
	"testing"

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
		// RN-45: the name of the owner is required.
		{name: "RN-45 empty name", ownerName: "", termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		{name: "RN-45 name with only spaces", ownerName: "   ", termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		{name: "name with 101 characters", ownerName: strings.Repeat("á", 101), termsVersion: CurrentTermsVersion, wantErr: ErrInvalidName},
		// RN-01: only the current version of the terms can be accepted.
		{name: "RN-01 old terms version", ownerName: "Ana", termsVersion: "2020-01-01", wantErr: ErrTermsVersion},
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
