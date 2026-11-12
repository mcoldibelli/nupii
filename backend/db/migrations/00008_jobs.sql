-- +goose Up
-- ADR 0003: the queue of background jobs.
CREATE TABLE jobs (
    id         uuid PRIMARY KEY DEFAULT uuidv7(),
    kind       text NOT NULL,
    payload    jsonb NOT NULL,
    status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
    attempts   integer NOT NULL DEFAULT 0,
    run_at     timestamptz NOT NULL DEFAULT now(),
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_pending_idx ON jobs (run_at) WHERE status = 'pending';

-- +goose Down
DROP TABLE jobs;
