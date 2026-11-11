package health

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func ptr[T any](v T) *T { return &v }

var _today = time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)

func day(offset int) time.Time { return _today.AddDate(0, 0, offset) }

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		input   Input
		wantErr string
	}{
		{name: "RN-77 vaccine", input: Input{Type: TypeVaccine, Date: day(-1), Name: ptr("V10"),
			NextDoseDate: ptr(day(364)), Remind: true}},
		{name: "RN-77 vaccine with no name", input: Input{Type: TypeVaccine, Date: day(0)}, wantErr: "name"},
		{name: "RN-77 next dose before the date", input: Input{Type: TypeVaccine, Date: day(0), Name: ptr("V10"),
			NextDoseDate: ptr(day(-1))}, wantErr: "nextDoseDate"},
		{name: "RN-78 consultation", input: Input{Type: TypeConsultation, Date: day(0), Reason: ptr("Tosse"),
			WeightKg: ptr(12.35), ReturnDate: ptr(day(7))}},
		{name: "RN-78 consultation with no reason", input: Input{Type: TypeConsultation, Date: day(0)}, wantErr: "reason"},
		{name: "RN-78 weight with 3 decimal places (RN-51)", input: Input{Type: TypeConsultation, Date: day(0),
			Reason: ptr("Peso"), WeightKg: ptr(12.345)}, wantErr: "weightKg"},
		{name: "RN-37 medication", input: Input{Type: TypeMedication, Date: day(0), Name: ptr("Bravecto"),
			MedicationCategory: ptr(CategoryFlea), IntervalDays: ptr(int32(90)), InUse: ptr(true), Remind: true}},
		{name: "RN-37 medication with no category", input: Input{Type: TypeMedication, Date: day(0),
			Name: ptr("Bravecto")}, wantErr: "medicationCategory"},
		{name: "RN-37 interval of 0 days", input: Input{Type: TypeMedication, Date: day(0), Name: ptr("X"),
			MedicationCategory: ptr("medication"), IntervalDays: ptr(int32(0))}, wantErr: "intervalDays"},
		{name: "RN-37 interval of 366 days", input: Input{Type: TypeMedication, Date: day(0), Name: ptr("X"),
			MedicationCategory: ptr("medication"), IntervalDays: ptr(int32(366))}, wantErr: "intervalDays"},
		{name: "RN-37 end before the start", input: Input{Type: TypeMedication, Date: day(0), Name: ptr("X"),
			MedicationCategory: ptr("medication"), EndDate: ptr(day(-1))}, wantErr: "endDate"},
		{name: "RN-37 category that does not exist", input: Input{Type: TypeMedication, Date: day(0), Name: ptr("X"),
			MedicationCategory: ptr("vitamin")}, wantErr: "medicationCategory"},
		{name: "RN-79 exam", input: Input{Type: TypeExam, Date: day(0), Name: ptr("Hemograma"),
			Result: ptr(strings.Repeat("ã", 2000))}},
		{name: "RN-79 exam with no name", input: Input{Type: TypeExam, Date: day(0)}, wantErr: "name"},
		{name: "RN-38 note", input: Input{Type: TypeNote, Date: day(0), Title: ptr("Pesagem"),
			NoteCategory: ptr("weight"), WeightKg: ptr(10.0)}},
		{name: "RN-38 note with no title", input: Input{Type: TypeNote, Date: day(0), NoteCategory: ptr("note")},
			wantErr: "title"},
		{name: "RN-38 note with no category", input: Input{Type: TypeNote, Date: day(0), Title: ptr("A")},
			wantErr: "noteCategory"},
		{name: "RN-76 type that does not exist", input: Input{Type: "surgery", Date: day(0)}, wantErr: "type"},
		{name: "RN-76 date in the future", input: Input{Type: TypeExam, Date: day(1), Name: ptr("X")}, wantErr: "date"},
		{name: "RN-76 notes with 2001 characters", input: Input{Type: TypeExam, Date: day(0), Name: ptr("X"),
			Notes: ptr(strings.Repeat("a", 2001))}, wantErr: "notes"},
		{name: "RN-80 name with 121 characters", input: Input{Type: TypeExam, Date: day(0),
			Name: ptr(strings.Repeat("a", 121))}, wantErr: "name"},
		{name: "RN-80 a field of another type", input: Input{Type: TypeExam, Date: day(0), Name: ptr("X"),
			Reason: ptr("Tosse")}, wantErr: "reason"},
		{name: "RN-80 remind in a type with no reminder", input: Input{Type: TypeExam, Date: day(0), Name: ptr("X"),
			Remind: true}, wantErr: "remind"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := validate(tt.input, _today)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("validate: %v", err)
				}
				return
			}
			validation, ok := errors.AsType[*ValidationError](err)
			if !ok || !strings.Contains(validation.Message, tt.wantErr) {
				t.Errorf("error = %v, want a ValidationError about %q", err, tt.wantErr)
			}
		})
	}
}

// RN-80: os espaços do começo e do fim são removidos, e um texto vazio fica sem valor.
func TestValidateCleansTheTexts(t *testing.T) {
	got, err := validate(Input{Type: TypeExam, Date: day(0), Name: ptr("  Hemograma "), Lab: ptr("  "),
		Notes: ptr(" Jejum. ")}, _today)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if *got.Name != "Hemograma" || got.Lab != nil || *got.Notes != "Jejum." {
		t.Errorf("validate = name %q, lab %v, notes %q", *got.Name, got.Lab, *got.Notes)
	}
	// A name of only spaces is no name.
	if _, err := validate(Input{Type: TypeExam, Date: day(0), Name: ptr("   ")}, _today); err == nil {
		t.Error("an exam with a name of only spaces: no error")
	}
}
