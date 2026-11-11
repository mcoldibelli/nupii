package pets

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func ptr[T any](value T) *T { return &value }

func TestValidate(t *testing.T) {
	now := time.Date(2026, 11, 11, 15, 0, 0, 0, time.UTC)
	today := time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)
	valid := func(change func(*Input)) Input {
		input := Input{Name: "Rex", Species: "dog"}
		if change != nil {
			change(&input)
		}
		return input
	}
	tests := []struct {
		name    string
		input   Input
		wantErr string // part of the message, or empty for valid data
	}{
		{name: "only the required data", input: valid(nil)},
		{name: "all the data", input: valid(func(in *Input) {
			in.Breed, in.Sex, in.Size = ptr("Vira-lata"), ptr("male"), ptr("medium")
			in.BirthDate, in.WeightKg, in.Neutered = ptr(today.AddDate(-3, 0, 0)), ptr(12.35), ptr(true)
			in.VetName, in.VetClinic, in.VetPhone = ptr("Dra. Bia"), ptr("Clínica Central"), ptr("11 99999-0000")
		})},
		// RN-48: o nome e a espécie do pet são obrigatórios.
		{name: "RN-48 empty name", input: valid(func(in *Input) { in.Name = "  " }), wantErr: "name is required"},
		{name: "RN-48 no species", input: valid(func(in *Input) { in.Species = "" }), wantErr: "species"},
		{name: "RN-48 species that is not in the list", input: valid(func(in *Input) { in.Species = "bird" }), wantErr: "species"},
		// RN-49: sexo e porte têm uma lista de valores e são opcionais.
		{name: "RN-49 sex that is not in the list", input: valid(func(in *Input) { in.Sex = ptr("x") }), wantErr: "sex"},
		{name: "RN-49 size that is not in the list", input: valid(func(in *Input) { in.Size = ptr("huge") }), wantErr: "size"},
		// RN-50: a data de nascimento não é uma data futura.
		{name: "RN-50 birth date of today", input: valid(func(in *Input) { in.BirthDate = ptr(today) })},
		{name: "RN-50 birth date of tomorrow", input: valid(func(in *Input) { in.BirthDate = ptr(today.AddDate(0, 0, 1)) }), wantErr: "birthDate"},
		// RN-51: o peso fica entre 0,01 kg e 999,99 kg, com no máximo 2 casas decimais.
		{name: "RN-51 minimum weight", input: valid(func(in *Input) { in.WeightKg = ptr(0.01) })},
		{name: "RN-51 maximum weight", input: valid(func(in *Input) { in.WeightKg = ptr(999.99) })},
		{name: "RN-51 zero weight", input: valid(func(in *Input) { in.WeightKg = ptr(0.0) }), wantErr: "weightKg"},
		{name: "RN-51 weight over the maximum", input: valid(func(in *Input) { in.WeightKg = ptr(1000.0) }), wantErr: "weightKg"},
		{name: "RN-51 weight with 3 decimal places", input: valid(func(in *Input) { in.WeightKg = ptr(12.345) }), wantErr: "weightKg"},
		// RN-56: tamanhos máximos dos textos do pet.
		{name: "RN-56 name with 100 characters", input: valid(func(in *Input) { in.Name = strings.Repeat("é", 100) })},
		{name: "RN-56 name with 101 characters", input: valid(func(in *Input) { in.Name = strings.Repeat("é", 101) }), wantErr: "name must have at most 100"},
		{name: "RN-56 breed with 101 characters", input: valid(func(in *Input) { in.Breed = ptr(strings.Repeat("a", 101)) }), wantErr: "breed must have at most 100"},
		{name: "RN-56 vet name with 121 characters", input: valid(func(in *Input) { in.VetName = ptr(strings.Repeat("a", 121)) }), wantErr: "vetName must have at most 120"},
		{name: "RN-56 vet clinic with 121 characters", input: valid(func(in *Input) { in.VetClinic = ptr(strings.Repeat("a", 121)) }), wantErr: "vetClinic must have at most 120"},
		{name: "RN-56 vet phone with 31 characters", input: valid(func(in *Input) { in.VetPhone = ptr(strings.Repeat("1", 31)) }), wantErr: "vetPhone must have at most 30"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := validate(tt.input, now)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("validate: %v, want no error", err)
				}
				return
			}
			var validation *ValidationError
			if !errors.As(err, &validation) || !strings.Contains(validation.Message, tt.wantErr) {
				t.Fatalf("validate error = %v, want a ValidationError with %q", err, tt.wantErr)
			}
		})
	}
}

func TestValidateNormalizesTheTexts(t *testing.T) {
	input := Input{Name: "  Rex ", Species: "dog", Breed: ptr("  "), VetName: ptr(" Dra. Bia ")}

	got, err := validate(input, time.Now())
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if got.Name != "Rex" {
		t.Errorf("Name = %q, want %q", got.Name, "Rex")
	}
	if got.Breed != nil {
		t.Errorf("Breed = %q, want nil for an empty text", *got.Breed)
	}
	if got.VetName == nil || *got.VetName != "Dra. Bia" {
		t.Errorf("VetName = %v, want %q", got.VetName, "Dra. Bia")
	}
}

// RN-54: a foto de perfil é uma imagem JPEG, PNG ou WebP, com no máximo 5 MB.
func TestCheckPhoto(t *testing.T) {
	jpeg := []byte("\xFF\xD8\xFF\xE0the rest of a JPEG file")
	png := []byte("\x89PNG\x0D\x0A\x1A\x0Athe rest of a PNG file")
	webp := []byte("RIFF\x00\x00\x00\x00WEBPVP8 the rest of a WebP file")
	withSize := func(start []byte, size int) []byte {
		data := make([]byte, size)
		copy(data, start)
		return data
	}
	tests := []struct {
		name          string
		data          []byte
		wantType      string
		wantExtension string
		wantErr       string
	}{
		{name: "RN-54 JPEG", data: jpeg, wantType: "image/jpeg", wantExtension: "jpg"},
		{name: "RN-54 PNG", data: png, wantType: "image/png", wantExtension: "png"},
		{name: "RN-54 WebP", data: webp, wantType: "image/webp", wantExtension: "webp"},
		{name: "RN-54 JPEG with 5 MB", data: withSize(jpeg, 5<<20), wantType: "image/jpeg", wantExtension: "jpg"},
		{name: "RN-54 JPEG with 5 MB and 1 byte", data: withSize(jpeg, 5<<20+1), wantErr: "at most 5 MB"},
		{name: "RN-54 text file", data: []byte("this is not an image"), wantErr: "JPEG, PNG or WebP"},
		{name: "RN-54 GIF", data: []byte("GIF89a the rest of a GIF file"), wantErr: "JPEG, PNG or WebP"},
		{name: "RN-54 empty file", data: nil, wantErr: "JPEG, PNG or WebP"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			contentType, extension, err := checkPhoto(tt.data)
			if tt.wantErr != "" {
				var validation *ValidationError
				if !errors.As(err, &validation) || !strings.Contains(validation.Message, tt.wantErr) {
					t.Fatalf("checkPhoto error = %v, want a ValidationError with %q", err, tt.wantErr)
				}
				return
			}
			if err != nil || contentType != tt.wantType || extension != tt.wantExtension {
				t.Errorf("checkPhoto = %q, %q, %v, want %q, %q, nil", contentType, extension, err, tt.wantType, tt.wantExtension)
			}
		})
	}
}
