package alerts

import "testing"

func TestTexts(t *testing.T) {
	place := "Praça da Sé"
	tests := []struct {
		name      string
		title     string
		body      string
		wantTitle string
		wantBody  string
	}{
		{
			name:      "lost nearby, with the place",
			title:     lostNearbyTitle,
			body:      lostNearbyBody(LostReport{PetName: "Rex", Place: &place}),
			wantTitle: "Pet desaparecido perto de você",
			wantBody:  "Rex sumiu perto de Praça da Sé. Se você vir, avise pelo Nupii.",
		},
		{
			name:      "lost nearby, with no place",
			title:     lostNearbyTitle,
			body:      lostNearbyBody(LostReport{PetName: "Rex"}),
			wantTitle: "Pet desaparecido perto de você",
			wantBody:  "Rex sumiu perto de você. Se você vir, avise pelo Nupii.",
		},
		{
			name:      "sighting",
			title:     sightingTitle(Sighting{PetName: "Rex"}),
			body:      sightingBody(Sighting{PetName: "Rex", Place: &place}),
			wantTitle: "Alguém viu Rex",
			wantBody:  "Uma pessoa viu Rex perto de Praça da Sé. O avistamento está na ficha.",
		},
		{
			name:      "found",
			title:     foundTitle(Found{PetName: "Rex"}),
			body:      foundBody(Found{PetName: "Rex", ContactName: "Caio"}),
			wantTitle: "Alguém encontrou Rex",
			wantBody:  "Caio reconheceu Rex pela foto do focinho e deixou o contato. Veja os avisos de encontro.",
		},
	}
	for _, tt := range tests {
		if tt.title != tt.wantTitle || tt.body != tt.wantBody {
			t.Errorf("%s: %q / %q, want %q / %q", tt.name, tt.title, tt.body, tt.wantTitle, tt.wantBody)
		}
	}
}
