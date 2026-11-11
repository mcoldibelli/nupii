-- name: LockPet :one
-- Locks the pet until the transaction ends, so two registrations of the
-- same pet run one after the other, and the pet is not deleted between them.
SELECT p.id
FROM pets AS p
WHERE p.id = sqlc.arg(id) AND p.deleted_at IS NULL
FOR UPDATE;

-- name: DemotePrimaryNoseprint :exec
UPDATE noseprints
SET is_primary = false
WHERE pet_id = sqlc.arg(pet_id) AND is_primary;

-- name: CreateNoseprint :one
-- The vector comes as text, in the format of pgvector: [0.1,0.2,...].
INSERT INTO noseprints (pet_id, image_key, embedding, model_version, quality, is_primary)
VALUES (
    sqlc.arg(pet_id),
    sqlc.arg(image_key),
    sqlc.arg(embedding)::text::vector,
    sqlc.arg(model_version),
    sqlc.arg(quality),
    true
)
RETURNING id, image_key, model_version, quality, captured_at;

-- name: GetPrimaryNoseprint :one
SELECT n.id, n.image_key, n.model_version, n.quality, n.captured_at
FROM noseprints AS n
WHERE n.pet_id = sqlc.arg(pet_id) AND n.is_primary;
