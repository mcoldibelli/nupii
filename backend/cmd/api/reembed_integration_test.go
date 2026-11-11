//go:build integration

package main

import (
	"errors"
	"testing"

	"github.com/mcoldibelli/nupii/backend/internal/api"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
)

// RF-15, RN-67: o sistema calcula de novo os vetores gravados com outra
// versão do modelo, a partir da foto guardada.
func TestReembedAfterAModelVersionChange(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	oldVersion := g.modelVersion
	testAPI.dogWithNoses(g, "token-ana", "Rex", 10, 0.90)
	testAPI.dogWithNoses(g, "token-ana", "Mel", 20, 0.60)
	// The new model version refuses the stored photo of Blur.
	blurPhoto := g.photo(0.70, 30)
	blur := testAPI.createPet("token-ana", `{"name": "Blur", "species": "dog"}`)
	if rec := testAPI.upload("POST", "token-ana", "/v1/pets/"+blur.Id.String()+"/noseprints", blurPhoto); rec.Code != 201 {
		t.Fatalf("register the nose of Blur: status = %d", rec.Code)
	}
	query := g.queryPhoto()
	candidates := func() []string {
		t.Helper()
		found := decode[api.Identification](t, testAPI.public("/v1/identifications", nil, query))
		names := make([]string, 0, len(found.Candidates))
		for _, c := range found.Candidates {
			names = append(names, c.PetName)
		}
		return names
	}

	// The inference service gets a new model. The vectors of the photos
	// are the same in this test: only the label changes.
	g.modelVersion = "test-new-" + oldVersion
	embedWithNewModel := testAPI.embedder.embed
	testAPI.embedder.embed = func(image []byte) (inference.Embedding, error) {
		if string(image) == string(blurPhoto) {
			return inference.Embedding{}, inference.ErrLowQuality
		}
		return embedWithNewModel(image)
	}
	testAPI.embedder.modelVersion = func() (string, error) { return g.modelVersion, nil }
	// RN-10: a busca lê só os cadastros da mesma versão do modelo.
	if got := candidates(); len(got) != 0 {
		t.Fatalf("candidates before the recompute = %v, want none: the noseprints have the old version", got)
	}

	// The database has noseprints of other tests too, so the counts of
	// the result are a minimum, and the exact counts come from the versions
	// of this test.
	result, err := testAPI.noseprints.Reembed(t.Context())
	if err != nil {
		t.Fatalf("Reembed: %v", err)
	}
	if result.ModelVersion != g.modelVersion || result.Pending < 3 || result.Updated != 2 || result.Skipped < 1 {
		t.Errorf("Reembed = %+v, want the new version, 2 updated, and Blur skipped", result)
	}
	if old, updated := testAPI.countVersion(oldVersion), testAPI.countVersion(g.modelVersion); old != 1 || updated != 2 {
		t.Errorf("%d noseprints with the old version and %d with the new one, want 1 (Blur) and 2", old, updated)
	}
	if got := candidates(); len(got) != 2 || got[0] != "Rex" || got[1] != "Mel" {
		t.Errorf("candidates after the recompute = %v, want Rex and Mel", got)
	}

	// Executar duas vezes dá o mesmo resultado.
	again, err := testAPI.noseprints.Reembed(t.Context())
	if err != nil {
		t.Fatalf("second Reembed: %v", err)
	}
	if again.Updated != 0 {
		t.Errorf("second Reembed updated %d noseprints, want 0", again.Updated)
	}
	if got := candidates(); len(got) != 2 {
		t.Errorf("candidates after the second recompute = %v, want Rex and Mel", got)
	}
}

// countVersion returns the number of noseprints with the model version.
func (a testAPI) countVersion(modelVersion string) int {
	a.t.Helper()
	var count int
	const query = "SELECT count(*) FROM noseprints WHERE model_version = $1"
	if err := a.pool.QueryRow(a.t.Context(), query, modelVersion).Scan(&count); err != nil {
		a.t.Fatalf("count the noseprints of a version: %v", err)
	}
	return count
}

func TestReembedStopsWhenTheInferenceServiceDoesNotRespond(t *testing.T) {
	testAPI := petsAPI(t)
	g := newGallery(testAPI)
	oldVersion := g.modelVersion
	testAPI.dogWithNoses(g, "token-ana", "Rex", 10, 0.90)
	testAPI.dogWithNoses(g, "token-ana", "Mel", 20, 0.60)

	testAPI.embedder.modelVersion = func() (string, error) { return "", inference.ErrUnavailable }
	if _, err := testAPI.noseprints.Reembed(t.Context()); !errors.Is(err, inference.ErrUnavailable) {
		t.Errorf("Reembed with no model version: error = %v, want ErrUnavailable", err)
	}

	testAPI.embedder.modelVersion = func() (string, error) { return "test-new-" + oldVersion, nil }
	testAPI.embedder.embed = func([]byte) (inference.Embedding, error) {
		return inference.Embedding{}, inference.ErrUnavailable
	}
	result, err := testAPI.noseprints.Reembed(t.Context())
	if !errors.Is(err, inference.ErrUnavailable) {
		t.Errorf("Reembed with a service that stops: error = %v, want ErrUnavailable", err)
	}
	// The noseprints stay for the next start of the API.
	if result.Updated != 0 || testAPI.countVersion(oldVersion) != 2 {
		t.Errorf("Reembed = %+v with %d noseprints of the old version, want 0 updated and 2",
			result, testAPI.countVersion(oldVersion))
	}
}
