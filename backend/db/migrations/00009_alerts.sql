-- +goose Up
-- RN-30: o sistema guarda só a última localização do tutor.
CREATE TABLE owner_locations (
    owner_id   uuid PRIMARY KEY REFERENCES owners (id),
    location   geography(Point, 4326) NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX owner_locations_location_idx ON owner_locations USING gist (location);

CREATE TABLE notifications (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    owner_id    uuid NOT NULL REFERENCES owners (id),
    kind        text NOT NULL CHECK (kind IN ('lost_nearby', 'sighting', 'found')),
    -- The event of the notification: the lost report, the sighting or the
    -- confirmed candidate. A job that runs two times does not repeat it.
    source_id   uuid NOT NULL,
    report_id   uuid,
    title       text NOT NULL,
    body        text NOT NULL,
    distance_m  integer,
    push_status text NOT NULL DEFAULT 'pending'
        CHECK (push_status IN ('pending', 'sent', 'not_sent', 'failed')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    read_at     timestamptz,
    CONSTRAINT notifications_event_key UNIQUE (owner_id, kind, source_id)
);

CREATE INDEX notifications_owner_idx ON notifications (owner_id, created_at DESC);

-- +goose Down
DROP TABLE notifications;
DROP TABLE owner_locations;
