-- +goose Up
CREATE TABLE pets (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    owner_id   uuid NOT NULL REFERENCES owners (id),
    name       text NOT NULL,
    species    text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
    breed      text,
    sex        text CHECK (sex IN ('male', 'female', 'unknown')),
    size       text CHECK (size IN ('small', 'medium', 'large')),
    birth_date date,
    weight_kg  numeric(5, 2) CHECK (weight_kg > 0),
    neutered   boolean,
    vet_name   text,
    vet_clinic text,
    vet_phone  text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX pets_owner_id_idx ON pets (owner_id) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE pets;
