//go:build integration

package firebase

import (
	"crypto/rand"
	"os"
	"testing"
)

// RN-03: um usuário que já não existe no provedor conta como apagado.
func TestDeleteUserThatDoesNotExist(t *testing.T) {
	if os.Getenv("FIREBASE_AUTH_EMULATOR_HOST") == "" {
		t.Fatal("FIREBASE_AUTH_EMULATOR_HOST is not set: start the compose (see backend/README.md)")
	}
	verifier, err := NewVerifier(t.Context(), "demo-nupii")
	if err != nil {
		t.Fatalf("create the verifier: %v", err)
	}
	if err := verifier.DeleteUser(t.Context(), "uid-"+rand.Text()); err != nil {
		t.Errorf("delete a user that does not exist: %v, want nil", err)
	}
}
