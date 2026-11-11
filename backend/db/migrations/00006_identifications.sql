-- +goose Up
CREATE TABLE identifications (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    model_version   text NOT NULL,
    -- RN-61: o ponto de quem encontrou o cão é opcional.
    location        geography(Point, 4326),
    -- RN-16: a foto da consulta só é gravada quando há confirmação.
    photo_key       text,
    contact_name    text,
    contact_phone   text,
    contact_message text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identification_candidates (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    identification_id uuid NOT NULL REFERENCES identifications (id),
    noseprint_id      uuid NOT NULL REFERENCES noseprints (id),
    pet_id            uuid NOT NULL REFERENCES pets (id),
    rank              smallint NOT NULL,
    similarity        double precision NOT NULL,
    confirmed_at      timestamptz,
    CONSTRAINT identification_candidates_rank_key UNIQUE (identification_id, rank)
);

CREATE INDEX identification_candidates_confirmed_pet_idx
    ON identification_candidates (pet_id) WHERE confirmed_at IS NOT NULL;

-- +goose Down
DROP TABLE identification_candidates;
DROP TABLE identifications;
