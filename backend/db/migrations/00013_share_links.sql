-- +goose Up
-- RN-39: só o SHA-256 do token vai para o banco.
CREATE TABLE share_links (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    pet_id     uuid NOT NULL REFERENCES pets (id),
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    opens      integer NOT NULL DEFAULT 0,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX share_links_pet_idx ON share_links (pet_id, created_at);

-- +goose Down
DROP TABLE share_links;
