package biometrics

import (
	"slices"
	"testing"
)

func TestStrongThreshold(t *testing.T) {
	// RN-15: vale a menor linha da tabela que não é menor que o acervo.
	// Acima de 300, vale a linha de 300.
	tests := []struct {
		gallery int64
		want    float64
	}{
		{gallery: 0, want: 0.737},
		{gallery: 1, want: 0.737},
		{gallery: 25, want: 0.737},
		{gallery: 26, want: 0.765},
		{gallery: 50, want: 0.765},
		{gallery: 51, want: 0.785},
		{gallery: 100, want: 0.785},
		{gallery: 101, want: 0.788},
		{gallery: 200, want: 0.788},
		{gallery: 201, want: 0.793},
		{gallery: 300, want: 0.793},
		{gallery: 301, want: 0.793},
		{gallery: 100_000, want: 0.793},
	}
	for _, tt := range tests {
		if got := strongThreshold(tt.gallery); got != tt.want {
			t.Errorf("strongThreshold(%d) = %v, want %v", tt.gallery, got, tt.want)
		}
	}
}

func TestRank(t *testing.T) {
	// The search gives the matches from the most similar to the least similar.
	tests := []struct {
		name    string
		matches []match
		gallery int64
		want    []candidate
	}{
		{
			name:    "no match",
			gallery: 10,
		},
		{
			name: "RN-12 one candidate for each pet, with its most similar photo",
			matches: []match{
				{NoseprintID: "rex-2", PetID: "rex", Similarity: 0.9},
				{NoseprintID: "rex-1", PetID: "rex", Similarity: 0.8},
				{NoseprintID: "mel-1", PetID: "mel", Similarity: 0.5},
			},
			gallery: 10,
			want: []candidate{
				{match: match{NoseprintID: "rex-2", PetID: "rex", Similarity: 0.9}, Strong: true},
				{match: match{NoseprintID: "mel-1", PetID: "mel", Similarity: 0.5}},
			},
		},
		{
			name: "RN-13 a similarity below 0.351 is not a candidate",
			matches: []match{
				{NoseprintID: "a", PetID: "a", Similarity: 0.351},
				{NoseprintID: "b", PetID: "b", Similarity: 0.3509},
			},
			gallery: 10,
			want:    []candidate{{match: match{NoseprintID: "a", PetID: "a", Similarity: 0.351}}},
		},
		{
			name: "RN-14 at most 3 candidates, of 3 different pets",
			matches: []match{
				{NoseprintID: "a-1", PetID: "a", Similarity: 0.70},
				{NoseprintID: "a-2", PetID: "a", Similarity: 0.69},
				{NoseprintID: "b-1", PetID: "b", Similarity: 0.68},
				{NoseprintID: "c-1", PetID: "c", Similarity: 0.67},
				{NoseprintID: "d-1", PetID: "d", Similarity: 0.66},
			},
			gallery: 10,
			want: []candidate{
				{match: match{NoseprintID: "a-1", PetID: "a", Similarity: 0.70}},
				{match: match{NoseprintID: "b-1", PetID: "b", Similarity: 0.68}},
				{match: match{NoseprintID: "c-1", PetID: "c", Similarity: 0.67}},
			},
		},
		{
			name: "RN-15 strong at the threshold of a gallery of 25 pets",
			matches: []match{
				{NoseprintID: "a", PetID: "a", Similarity: 0.737},
				{NoseprintID: "b", PetID: "b", Similarity: 0.7369},
			},
			gallery: 25,
			want: []candidate{
				{match: match{NoseprintID: "a", PetID: "a", Similarity: 0.737}, Strong: true},
				{match: match{NoseprintID: "b", PetID: "b", Similarity: 0.7369}},
			},
		},
		{
			name:    "RN-15 the same similarity is not strong in a gallery of 26 pets",
			matches: []match{{NoseprintID: "a", PetID: "a", Similarity: 0.737}},
			gallery: 26,
			want:    []candidate{{match: match{NoseprintID: "a", PetID: "a", Similarity: 0.737}}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := rank(tt.matches, tt.gallery); !slices.Equal(got, tt.want) {
				t.Errorf("rank = %+v, want %+v", got, tt.want)
			}
		})
	}
}
