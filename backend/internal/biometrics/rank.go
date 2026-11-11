package biometrics

const (
	// RN-13: uma similaridade abaixo de 0,351 não vira candidato.
	_minSimilarity = 0.351
	// RN-14: a identificação devolve no máximo 3 candidatos.
	_maxCandidates = 3
)

// RN-15: limiares de correspondência forte, por tamanho do acervo. Os
// valores vêm da calibração do modelo tinyvit21m-s43.
var _strongThresholds = []struct {
	gallerySize int64
	similarity  float64
}{
	{gallerySize: 25, similarity: 0.737},
	{gallerySize: 50, similarity: 0.765},
	{gallerySize: 100, similarity: 0.785},
	{gallerySize: 200, similarity: 0.788},
	{gallerySize: 300, similarity: 0.793},
}

// match is one noseprint that the search read, with the cosine between its
// vector and the vector of the photo.
type match struct {
	NoseprintID string
	PetID       string
	Similarity  float64
}

// candidate is the best match of one pet.
type candidate struct {
	match

	// Strong tells if the similarity reaches the threshold of the size of
	// the gallery (RN-15).
	Strong bool
}

// strongThreshold returns the similarity of a strong match for a gallery
// with gallerySize pets.
//
// RN-15: vale a menor linha da tabela que não é menor que o acervo. Acima
// de 300, vale a linha de 300.
func strongThreshold(gallerySize int64) float64 {
	for _, row := range _strongThresholds {
		if gallerySize <= row.gallerySize {
			return row.similarity
		}
	}
	return _strongThresholds[len(_strongThresholds)-1].similarity
}

// rank returns the candidates of an identification. matches come from the
// most similar to the least similar, and gallerySize is the number of pets
// in the search.
func rank(matches []match, gallerySize int64) []candidate {
	threshold := strongThreshold(gallerySize)
	var candidates []candidate
	seen := make(map[string]bool, _maxCandidates)
	for _, found := range matches {
		if len(candidates) == _maxCandidates || found.Similarity < _minSimilarity {
			break
		}
		// RN-12: vale a foto mais parecida de cada pet. It is the first
		// one of the pet, because of the order of matches.
		if seen[found.PetID] {
			continue
		}
		seen[found.PetID] = true
		candidates = append(candidates, candidate{
			match:  found,
			Strong: found.Similarity >= threshold,
		})
	}
	return candidates
}
