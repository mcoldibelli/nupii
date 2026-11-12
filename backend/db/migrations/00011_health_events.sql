-- +goose Up
-- ADR 0026: one table for the five types of health event, with the columns
-- of each type. A CHECK for each type keeps its required fields.
CREATE TABLE health_events (
    id                  uuid PRIMARY KEY DEFAULT uuidv7(),
    pet_id              uuid NOT NULL REFERENCES pets (id),
    type                text NOT NULL CHECK (type IN ('vaccine', 'consultation', 'medication', 'exam', 'note')),
    date                date NOT NULL,
    notes               text,
    -- The name of a vaccine, of a medication or of an exam.
    name                text,
    vet                 text,
    -- Vaccine.
    manufacturer        text,
    batch               text,
    dose                text,
    next_dose_date      date,
    -- Consultation.
    clinic              text,
    reason              text,
    diagnosis           text,
    weight_kg           numeric(5, 2),
    return_date         date,
    -- Medication.
    medication_category text CHECK (medication_category IN ('medication', 'flea', 'deworm')),
    active_ingredient   text,
    dosage              text,
    frequency           text,
    end_date            date,
    in_use              boolean,
    interval_days       integer CHECK (interval_days BETWEEN 1 AND 365),
    -- Exam.
    lab                 text,
    result              text,
    -- Note.
    note_category       text CHECK (note_category IN ('disease', 'weight', 'allergy', 'surgery', 'note', 'symptom')),
    title               text,
    -- Vaccine and medication: the event is in the upcoming care (RN-81).
    remind              boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT health_events_vaccine CHECK (type <> 'vaccine' OR name IS NOT NULL),
    CONSTRAINT health_events_consultation CHECK (type <> 'consultation' OR reason IS NOT NULL),
    CONSTRAINT health_events_medication CHECK (
        type <> 'medication' OR (name IS NOT NULL AND medication_category IS NOT NULL)),
    CONSTRAINT health_events_exam CHECK (type <> 'exam' OR name IS NOT NULL),
    CONSTRAINT health_events_note CHECK (type <> 'note' OR (title IS NOT NULL AND note_category IS NOT NULL))
);

CREATE INDEX health_events_pet_idx ON health_events (pet_id, date DESC);

-- +goose Down
DROP TABLE health_events;
