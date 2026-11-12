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
RETURNING id, occurred_at, created_at;

-- name: GetReport :one
SELECT * FROM report_views WHERE id = sqlc.arg(id);

-- name: ListBoard :many
-- RN-24: 20 ocorrências abertas por página, da mais nova para a mais antiga,
-- do tipo e dentro do raio quando o filtro vem.
SELECT * FROM report_views
WHERE status = 'open'
    AND (sqlc.narg(type)::text IS NULL OR type = sqlc.narg(type)::text)
    AND (sqlc.narg(radius_m)::float8 IS NULL OR ST_DWithin(
        ST_MakePoint(longitude, latitude)::geography,
        ST_MakePoint(sqlc.narg(longitude)::float8, sqlc.narg(latitude)::float8)::geography,
        sqlc.narg(radius_m)::float8))
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(skip);

-- name: CountBoard :one
-- The counts follow the radius, not the type.
SELECT
    count(*) FILTER (WHERE type = 'lost') AS open_lost,
    count(*) FILTER (WHERE type = 'found') AS open_found
FROM report_views
WHERE status = 'open'
    AND (sqlc.narg(radius_m)::float8 IS NULL OR ST_DWithin(
        ST_MakePoint(longitude, latitude)::geography,
        ST_MakePoint(sqlc.narg(longitude)::float8, sqlc.narg(latitude)::float8)::geography,
        sqlc.narg(radius_m)::float8));

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
SELECT r.type, r.status, r.latitude, r.longitude, r.owner_id, v.pet_name
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
-- A lost report of a deleted pet is not in report_views: it does not exist
-- for anyone, also for the author.
UPDATE reports AS r
SET status = 'resolved', resolved_at = COALESCE(r.resolved_at, now())
WHERE r.id = sqlc.arg(id) AND r.owner_id = sqlc.arg(owner_id)
    AND EXISTS (SELECT 1 FROM report_views AS v WHERE v.id = r.id);

-- name: ResolveFoundReport :execrows
-- RN-69: quem tem o código resolve o achado.
UPDATE reports
SET status = 'resolved', resolved_at = COALESCE(resolved_at, now())
WHERE id = sqlc.arg(id) AND type = 'found' AND resolve_code_hash = sqlc.arg(resolve_code_hash);

-- name: EraseOwnerReports :exec
-- RN-84: um desaparecimento aberto do tutor fica resolvido, sem a descrição
-- e sem o lugar.
UPDATE reports
SET status = 'resolved', resolved_at = COALESCE(resolved_at, now()), description = NULL, place = NULL
WHERE owner_id = sqlc.arg(owner_id);
