-- +goose Up
CREATE TABLE noseprints (
    id            uuid PRIMARY KEY DEFAULT uuidv7(),
    pet_id        uuid NOT NULL REFERENCES pets (id),
    image_key     text NOT NULL,
    embedding     vector(512) NOT NULL,
    model_version text NOT NULL,
    quality       double precision NOT NULL CHECK (quality >= 0 AND quality <= 1),
    is_primary    boolean NOT NULL,
    captured_at   timestamptz NOT NULL DEFAULT now()
);

-- RN-09: um pet tem um cadastro principal.
CREATE UNIQUE INDEX noseprints_primary_idx ON noseprints (pet_id) WHERE is_primary;
CREATE INDEX noseprints_pet_id_idx ON noseprints (pet_id);
-- RN-10: a busca usa o cosseno.
CREATE INDEX noseprints_embedding_idx ON noseprints USING hnsw (embedding vector_cosine_ops);

-- +goose Down
DROP TABLE noseprints;
