//go:build integration

package biometrics

import (
	"context"
	"crypto/rand"
	"math"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mcoldibelli/nupii/backend/internal/biometrics/biometricsdb"
	"github.com/mcoldibelli/nupii/backend/internal/platform/inference"
	"github.com/mcoldibelli/nupii/backend/internal/platform/postgres/postgrestest"
)

// vectorWithSimilarity returns a vector with the given cosine with the
// vector of the search, which has the value 1 at index 0.
func vectorWithSimilarity(similarity float64) []float32 {
	vector := make([]float32, inference.Dimensions)
	vector[0] = float32(similarity)
	vector[1] = float32(math.Sqrt(1 - similarity*similarity))
	return vector
}

// seedGallery creates one owner with live pets and deleted pets, each one
// with one noseprint of modelVersion. The noseprints of the deleted pets
// are the most similar ones. It returns the highest similarity of a live pet.
func seedGallery(t *testing.T, pool *pgxpool.Pool, modelVersion string, live, deleted int) float64 {
	t.Helper()
	ctx := t.Context()
	uid := "uid-" + rand.Text()
	var ownerID string
	const createOwner = `INSERT INTO owners (firebase_uid, email, name, terms_version, terms_accepted_at)
		VALUES ($1, 'search@example.com', 'Search Test', '2026-11-10', now()) RETURNING id`
	if err := pool.QueryRow(ctx, createOwner, uid).Scan(&ownerID); err != nil {
		t.Fatalf("create the owner: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.WithoutCancel(ctx)
		for _, statement := range []string{
			"DELETE FROM noseprints WHERE pet_id IN (SELECT id FROM pets WHERE owner_id = $1)",
			"DELETE FROM pets WHERE owner_id = $1",
			"DELETE FROM owners WHERE id = $1",
		} {
			if _, err := pool.Exec(ctx, statement, ownerID); err != nil {
				t.Errorf("clean the gallery of the test: %v", err)
			}
		}
	})

	const createPet = `INSERT INTO pets (owner_id, name, species, deleted_at)
		VALUES ($1, 'Dog', 'dog', CASE WHEN $2 THEN now() END) RETURNING id`
	const createNoseprint = `INSERT INTO noseprints (pet_id, image_key, embedding, model_version, quality, is_primary)
		VALUES ($1, 'key', $2::text::vector, $3, 0.9, true)`
	// The similarities go down from 0.99, with the deleted pets first.
	similarity := 0.99
	bestLive := 0.0
	for i := range deleted + live {
		isDeleted := i < deleted
		var petID string
		if err := pool.QueryRow(ctx, createPet, ownerID, isDeleted).Scan(&petID); err != nil {
			t.Fatalf("create the pet %d: %v", i, err)
		}
		vector := vectorText(vectorWithSimilarity(similarity))
		if _, err := pool.Exec(ctx, createNoseprint, petID, vector, modelVersion); err != nil {
			t.Fatalf("create the noseprint %d: %v", i, err)
		}
		if !isDeleted && bestLive == 0 {
			bestLive = similarity
		}
		similarity -= 0.005
	}
	return bestLive
}

// RN-10: a busca lê os 50 cadastros mais parecidos, só da mesma versão do
// modelo. RN-11: ficam fora da busca os pets excluídos.
//
// The test makes the database use the index of the vectors, as it does
// with a large gallery. In a small table the database reads all the rows,
// and the limits of the index do not show.
func TestSearchReadsThe50MostSimilarNoseprintsOfLivePets(t *testing.T) {
	pool := postgrestest.Open(t)
	modelVersion := "test-" + rand.Text()
	bestLive := seedGallery(t, pool, modelVersion, 60, 60)
	seedGallery(t, pool, "test-"+rand.Text(), 5, 0) // Another model version.

	tx, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer func() {
		if err := tx.Rollback(context.WithoutCancel(t.Context())); err != nil {
			t.Errorf("rollback: %v", err)
		}
	}()
	for _, setting := range []string{"SET LOCAL enable_seqscan = off", "SET LOCAL enable_sort = off"} {
		if _, err := tx.Exec(t.Context(), setting); err != nil {
			t.Fatalf("%s: %v", setting, err)
		}
	}
	query := inference.Embedding{Vector: vectorWithSimilarity(1), ModelVersion: modelVersion}

	matches, gallerySize, err := search(t.Context(), biometricsdb.New(tx), pgx.Tx(tx), query)
	if err != nil {
		t.Fatalf("search: %v", err)
	}

	if len(matches) != 50 {
		t.Fatalf("the search read %d noseprints, want 50", len(matches))
	}
	if math.Abs(matches[0].Similarity-bestLive) > 1e-4 {
		t.Errorf("the most similar match has %.4f, want %.4f: the best noseprint of a live pet",
			matches[0].Similarity, bestLive)
	}
	for i := 1; i < len(matches); i++ {
		if matches[i].Similarity > matches[i-1].Similarity {
			t.Fatalf("match %d has %.4f after %.4f: the matches are not in order",
				i, matches[i].Similarity, matches[i-1].Similarity)
		}
	}
	// RN-15: o tamanho do acervo é o número de pets que entram na busca.
	if gallerySize != 60 {
		t.Errorf("gallery size = %d, want 60 live pets of the model version", gallerySize)
	}
}
