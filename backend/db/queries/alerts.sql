-- name: SetOwnerLocation :exec
-- RN-30: o sistema guarda só a última localização do tutor.
INSERT INTO owner_locations (owner_id, location, updated_at)
VALUES (
    sqlc.arg(owner_id),
    ST_SetSRID(ST_MakePoint(sqlc.arg(longitude)::float8, sqlc.arg(latitude)::float8), 4326)::geography,
    now()
)
ON CONFLICT (owner_id) DO UPDATE SET location = EXCLUDED.location, updated_at = now();

-- name: ListNearbyOwners :many
-- RN-32: até 3.000 m. RN-33: no máximo 100, os mais próximos. RN-34: sem o autor.
SELECT
    l.owner_id,
    ST_Distance(l.location, p.point)::float8 AS distance_m
FROM owner_locations AS l,
    (SELECT ST_SetSRID(ST_MakePoint(sqlc.arg(longitude)::float8, sqlc.arg(latitude)::float8), 4326)::geography AS point) AS p
WHERE ST_DWithin(l.location, p.point, sqlc.arg(radius_m)::float8)
    AND l.owner_id <> sqlc.arg(author_id)
ORDER BY distance_m
LIMIT sqlc.arg(max_owners);

-- name: CreateNotification :exec
-- A job that runs two times does not repeat the notification.
INSERT INTO notifications (owner_id, kind, source_id, report_id, title, body, distance_m)
VALUES (
    sqlc.arg(owner_id), sqlc.arg(kind), sqlc.arg(source_id), sqlc.narg(report_id),
    sqlc.arg(title), sqlc.arg(body), sqlc.narg(distance_m)
)
ON CONFLICT ON CONSTRAINT notifications_event_key DO NOTHING;

-- name: ListNotifications :many
-- RN-35: as 50 notificações mais recentes.
SELECT id, kind, report_id, title, body, distance_m, created_at, read_at
FROM notifications
WHERE owner_id = sqlc.arg(owner_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- name: MarkNotificationRead :execrows
-- RN-74: marcar de novo como lida não muda a data.
UPDATE notifications
SET read_at = COALESCE(read_at, now())
WHERE id = sqlc.arg(id) AND owner_id = sqlc.arg(owner_id);
