-- +goose Up
-- RN-31: um token de push pertence ao tutor que fez o último registro dele.
CREATE TABLE devices (
    token      text PRIMARY KEY,
    owner_id   uuid NOT NULL REFERENCES owners (id),
    platform   text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    active     boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX devices_owner_idx ON devices (owner_id) WHERE active;

-- +goose Down
DROP TABLE devices;
