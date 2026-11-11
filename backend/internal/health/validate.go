package health

import (
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mcoldibelli/nupii/backend/internal/pets"
)

// The types of health event.
const (
	TypeVaccine      = "vaccine"
	TypeConsultation = "consultation"
	TypeMedication   = "medication"
	TypeExam         = "exam"
	TypeNote         = "note"
)

// CategoryFlea and CategoryDeworm are the medications that RN-81 groups by
// category.
const (
	CategoryFlea   = "flea"
	CategoryDeworm = "deworm"
)

// RN-80: tamanhos máximos dos textos de um evento, em caracteres.
const (
	_maxShortText = 120
	_maxLongText  = 2000
)

// RN-37: o intervalo da medicação vai de 1 a 365 dias.
const (
	_minIntervalDays = 1
	_maxIntervalDays = 365
)

var (
	_types = []string{
		TypeVaccine, TypeConsultation, TypeMedication, TypeExam, TypeNote,
	}
	_medicationCategories = []string{"medication", CategoryFlea, CategoryDeworm}
	_noteCategories       = []string{"disease", "weight", "allergy", "surgery", "note", "symptom"}
)

// ValidationError is the error for data that breaks a rule. Message says
// which rule.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// Input is the data of a health event. The fields of each type are in the
// contract; a field of another type must be nil (RN-80).
type Input struct {
	Type  string
	Date  time.Time
	Notes *string
	// Name is the name of a vaccine, of a medication or of an exam.
	Name *string
	Vet  *string
	// Vaccine.
	Manufacturer *string
	Batch        *string
	Dose         *string
	NextDoseDate *time.Time
	// Consultation.
	Clinic     *string
	Reason     *string
	Diagnosis  *string
	WeightKg   *float64
	ReturnDate *time.Time
	// Medication.
	MedicationCategory *string
	ActiveIngredient   *string
	Dosage             *string
	Frequency          *string
	EndDate            *time.Time
	InUse              *bool
	IntervalDays       *int32
	// Exam.
	Lab    *string
	Result *string
	// Note.
	NoteCategory *string
	Title        *string
	// Remind puts a vaccine or a medication in the upcoming care (RN-81).
	Remind bool
}

// field is one optional field of an event: its name in the contract, if it
// is set, and the types that have it.
type field struct {
	name  string
	set   bool
	types []string
}

// texts returns the text fields of input with their limits, to clean them.
func (in *Input) texts() []struct {
	name  string
	value **string
	max   int
} {
	return []struct {
		name  string
		value **string
		max   int
	}{
		{"notes", &in.Notes, _maxLongText},
		{"name", &in.Name, _maxShortText},
		{"vet", &in.Vet, _maxShortText},
		{"manufacturer", &in.Manufacturer, _maxShortText},
		{"batch", &in.Batch, _maxShortText},
		{"dose", &in.Dose, _maxShortText},
		{"clinic", &in.Clinic, _maxShortText},
		{"reason", &in.Reason, _maxShortText},
		{"diagnosis", &in.Diagnosis, _maxLongText},
		{"activeIngredient", &in.ActiveIngredient, _maxShortText},
		{"dosage", &in.Dosage, _maxShortText},
		{"frequency", &in.Frequency, _maxShortText},
		{"lab", &in.Lab, _maxShortText},
		{"result", &in.Result, _maxLongText},
		{"title", &in.Title, _maxShortText},
	}
}

// fields returns the optional fields of input, with the types that have
// each one.
func (in Input) fields() []field {
	vaccine, consultation := TypeVaccine, TypeConsultation
	medication, exam, note := TypeMedication, TypeExam, TypeNote
	return []field{
		{"name", in.Name != nil, []string{vaccine, medication, exam}},
		{"vet", in.Vet != nil, []string{vaccine, consultation, exam}},
		{"manufacturer", in.Manufacturer != nil, []string{vaccine}},
		{"batch", in.Batch != nil, []string{vaccine}},
		{"dose", in.Dose != nil, []string{vaccine}},
		{"nextDoseDate", in.NextDoseDate != nil, []string{vaccine}},
		{"clinic", in.Clinic != nil, []string{consultation}},
		{"reason", in.Reason != nil, []string{consultation}},
		{"diagnosis", in.Diagnosis != nil, []string{consultation}},
		{"weightKg", in.WeightKg != nil, []string{consultation, note}},
		{"returnDate", in.ReturnDate != nil, []string{consultation}},
		{"medicationCategory", in.MedicationCategory != nil, []string{medication}},
		{"activeIngredient", in.ActiveIngredient != nil, []string{medication}},
		{"dosage", in.Dosage != nil, []string{medication}},
		{"frequency", in.Frequency != nil, []string{medication}},
		{"endDate", in.EndDate != nil, []string{medication}},
		{"inUse", in.InUse != nil, []string{medication}},
		{"intervalDays", in.IntervalDays != nil, []string{medication}},
		{"lab", in.Lab != nil, []string{exam}},
		{"result", in.Result != nil, []string{exam}},
		{"noteCategory", in.NoteCategory != nil, []string{note}},
		{"title", in.Title != nil, []string{note}},
		{"remind", in.Remind, []string{vaccine, medication}},
	}
}

// _required are the fields that each type must have (RN-37, RN-38, RN-77 to RN-79).
var _required = map[string][]string{
	TypeVaccine:      {"name"},
	TypeConsultation: {"reason"},
	TypeMedication:   {"name", "medicationCategory"},
	TypeExam:         {"name"},
	TypeNote:         {"title", "noteCategory"},
}

// validate applies the rules of a health event and returns it with the
// texts cleaned. today is the date of today, in UTC.
func validate(in Input, today time.Time) (Input, error) {
	invalid := func(format string, args ...any) (Input, error) {
		return Input{}, &ValidationError{Message: fmt.Sprintf(format, args...)}
	}
	// RN-76: todo evento tem tipo e data, e a data não é futura.
	if !slices.Contains(_types, in.Type) {
		return invalid("type must be vaccine, consultation, medication, exam or note")
	}
	if in.Date.After(today) {
		return invalid("date must not be in the future")
	}
	// RN-80: os espaços do começo e do fim são removidos, e um texto vazio
	// fica sem valor.
	for _, text := range in.texts() {
		if *text.value == nil {
			continue
		}
		cleaned := strings.TrimSpace(**text.value)
		if utf8.RuneCountInString(cleaned) > text.max {
			return invalid("%s must have at most %d characters", text.name, text.max)
		}
		*text.value = &cleaned
		if cleaned == "" {
			*text.value = nil
		}
	}
	// RN-80: um campo de outro tipo de evento é recusado.
	set := map[string]bool{}
	for _, f := range in.fields() {
		if f.set && !slices.Contains(f.types, in.Type) {
			return invalid("%s is not a field of the type %s", f.name, in.Type)
		}
		set[f.name] = f.set
	}
	for _, name := range _required[in.Type] {
		if !set[name] {
			return invalid("%s is required for the type %s", name, in.Type)
		}
	}
	// RN-37, RN-77: com a opção de lembrar, a medicação tem o intervalo e a
	// vacina tem a próxima dose.
	if in.Remind && in.Type == TypeMedication && in.IntervalDays == nil {
		return invalid("intervalDays is required with remind")
	}
	if in.Remind && in.Type == TypeVaccine && in.NextDoseDate == nil {
		return invalid("nextDoseDate is required with remind")
	}
	category := in.MedicationCategory
	if category != nil && !slices.Contains(_medicationCategories, *category) {
		return invalid("medicationCategory must be medication, flea or deworm")
	}
	if in.NoteCategory != nil && !slices.Contains(_noteCategories, *in.NoteCategory) {
		return invalid("noteCategory must be disease, weight, allergy, surgery, note or symptom")
	}
	for _, later := range []struct {
		name  string
		value *time.Time
	}{{"nextDoseDate", in.NextDoseDate}, {"returnDate", in.ReturnDate}, {"endDate", in.EndDate}} {
		if later.value != nil && later.value.Before(in.Date) {
			return invalid("%s must not be before date", later.name)
		}
	}
	if in.WeightKg != nil && !pets.ValidWeight(*in.WeightKg) {
		return invalid("weightKg must be from 0.01 to 999.99, with at most 2 decimal places")
	}
	if in.IntervalDays != nil &&
		(*in.IntervalDays < _minIntervalDays || *in.IntervalDays > _maxIntervalDays) {
		return invalid("intervalDays must be from 1 to 365")
	}
	return in, nil
}
