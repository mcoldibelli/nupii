-- +goose Up
CREATE TABLE owners (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    firebase_uid      text NOT NULL,
    email             text NOT NULL,
    name              text NOT NULL,
    terms_version     text NOT NULL,
    terms_accepted_at timestamptz NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT owners_firebase_uid_key UNIQUE (firebase_uid)
);

-- +goose Down
DROP TABLE owners;
