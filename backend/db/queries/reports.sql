-- name: CreateLostReport :one
INSERT INTO reports (type, owner_id, pet_id, latitude, longitude, place, description, occurred_at)
VALUES (
    'lost', sqlc.arg(owner_id), sqlc.arg(pet_id), sqlc.arg(latitude), sqlc.arg(longitude),
    sqlc.narg(place), sqlc.narg(description), sqlc.arg(occurred_at)
)
RETURNING id;

-- name: CreateFoundReport :one
INSERT INTO reports (type, photo_key, resolve_code_hash, latitude, longitude, place, description, occurred_at)
VALUES (
    'found', sqlc.arg(photo_key), sqlc.arg(resolve_code_hash), sqlc.arg(latitude),
    sqlc.arg(longitude), sqlc.narg(place), sqlc.narg(description), now()
)
RETURNING id;

-- name: GetReport :one
SELECT * FROM report_views WHERE id = sqlc.arg(id);

-- name: ListBoard :many
-- RN-24: 20 ocorrências abertas por página, da mais nova para a mais antiga.
SELECT * FROM report_views
WHERE status = 'open'
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(skip);

-- name: CountBoard :one
SELECT
    count(*) FILTER (WHERE type = 'lost') AS open_lost,
    count(*) FILTER (WHERE type = 'found') AS open_found
FROM report_views
WHERE status = 'open';

-- name: ListOwnerReports :many
SELECT * FROM report_views
WHERE owner_id = sqlc.arg(owner_id)
ORDER BY created_at DESC, id DESC;

-- name: ListSightings :many
-- RN-25: do mais antigo para o mais novo.
SELECT id, latitude, longitude, place, description, created_at
FROM sightings
WHERE report_id = sqlc.arg(report_id)
ORDER BY created_at, id;

-- name: LockOpenLostReport :one
-- RN-28: um avistamento só entra em um desaparecimento aberto. The lock puts
-- the sighting and the resolution of the report in sequence.
SELECT r.type, r.status, r.latitude, r.longitude
FROM reports AS r
JOIN report_views AS v ON v.id = r.id
WHERE r.id = sqlc.arg(id)
FOR SHARE OF r;

-- name: CreateSighting :one
INSERT INTO sightings (report_id, latitude, longitude, place, description)
VALUES (sqlc.arg(report_id), sqlc.arg(latitude), sqlc.arg(longitude), sqlc.narg(place), sqlc.narg(description))
RETURNING id, latitude, longitude, place, description, created_at;

-- name: ResolveOwnReport :execrows
-- RN-29: só o autor resolve. Resolver de novo não muda nada.
UPDATE reports
SET status = 'resolved', resolved_at = COALESCE(resolved_at, now())
WHERE id = sqlc.arg(id) AND owner_id = sqlc.arg(owner_id);

-- name: ResolveFoundReport :execrows
-- RN-69: quem tem o código resolve o achado.
UPDATE reports
SET status = 'resolved', resolved_at = COALESCE(resolved_at, now())
WHERE id = sqlc.arg(id) AND type = 'found' AND resolve_code_hash = sqlc.arg(resolve_code_hash);
