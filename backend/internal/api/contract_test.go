package api_test

import (
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

// _contractPath is the contract file, relative to this package.
const _contractPath = "../../../api/openapi.yaml"

// TestContractIsValid checks that the contract is a valid OpenAPI document
// for kin-openapi. The integration tests use kin-openapi to validate the
// responses of the API, so the contract can only use what kin-openapi accepts.
func TestContractIsValid(t *testing.T) {
	doc, err := openapi3.NewLoader().LoadFromFile(_contractPath)
	if err != nil {
		t.Fatalf("load %s: %v", _contractPath, err)
	}
	if err := doc.Validate(t.Context()); err != nil {
		t.Fatalf("validate %s: %v", _contractPath, err)
	}
}
