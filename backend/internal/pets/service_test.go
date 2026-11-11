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
