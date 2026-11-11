-- +goose Up
CREATE TABLE reports (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    type              text NOT NULL CHECK (type IN ('lost', 'found')),
    status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    -- The author: the owner of the pet of a lost report. A found report has none.
    owner_id          uuid REFERENCES owners (id),
    pet_id            uuid REFERENCES pets (id),
    -- The photo of the nose of a found report (RN-27).
    photo_key         text,
    -- RN-69: só o SHA-256 do código do achado vai para o banco.
    resolve_code_hash bytea,
    latitude          double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude         double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    place             text,
    description       text,
    occurred_at       timestamptz NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    resolved_at       timestamptz,
    CONSTRAINT reports_lost_has_pet CHECK (type <> 'lost' OR (pet_id IS NOT NULL AND owner_id IS NOT NULL)),
    CONSTRAINT reports_found_has_photo CHECK (
        type <> 'found' OR (photo_key IS NOT NULL AND resolve_code_hash IS NOT NULL))
);

-- RN-68: um pet tem no máximo um desaparecimento aberto.
CREATE UNIQUE INDEX reports_open_lost_pet_key ON reports (pet_id) WHERE type = 'lost' AND status = 'open';
CREATE INDEX reports_board_idx ON reports (created_at DESC, id DESC) WHERE status = 'open';
CREATE INDEX reports_owner_id_idx ON reports (owner_id);

CREATE TABLE sightings (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    report_id   uuid NOT NULL REFERENCES reports (id),
    latitude    double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude   double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    place       text,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sightings_report_id_idx ON sightings (report_id, created_at);

-- A report as the board and the detail show it. RN-24: a lost report of a
-- deleted pet is not in the view. RN-72: the view has no data of the author.
CREATE VIEW report_views AS
SELECT
    r.id,
    r.type,
    r.status,
    r.owner_id,
    r.pet_id,
    p.name AS pet_name,
    p.species AS pet_species,
    EXISTS (SELECT 1 FROM noseprints AS n WHERE n.pet_id = r.pet_id) AS pet_has_noseprint,
    COALESCE(p.photo_key, r.photo_key) AS photo_key,
    r.latitude,
    r.longitude,
    r.place,
    r.description,
    r.occurred_at,
    r.created_at
FROM reports AS r
LEFT JOIN pets AS p ON p.id = r.pet_id
WHERE r.type = 'found' OR p.deleted_at IS NULL;

-- +goose Down
DROP VIEW report_views;
DROP TABLE sightings;
DROP TABLE reports;
