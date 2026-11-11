-- +goose Up
CREATE TABLE health_attachments (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    event_id     uuid NOT NULL REFERENCES health_events (id),
    key          text NOT NULL,
    content_type text NOT NULL,
    file_name    text NOT NULL,
    size_bytes   integer NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX health_attachments_event_idx ON health_attachments (event_id, created_at);

-- +goose Down
DROP TABLE health_attachments;
