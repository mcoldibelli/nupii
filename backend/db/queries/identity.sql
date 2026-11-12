-- name: CreateOwner :one
-- Creates the owner of a Firebase user. When the user already has an owner,
-- the statement changes nothing and returns no row.
INSERT INTO owners (firebase_uid, email, name, terms_version, terms_accepted_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (firebase_uid) DO NOTHING
RETURNING *;

-- name: GetOwnerByFirebaseUID :one
SELECT * FROM owners WHERE firebase_uid = $1;

-- name: IsOwnerDeleted :one
-- RN-04: uma conta excluída recebe 401.
SELECT EXISTS (
    SELECT 1 FROM owners WHERE firebase_uid = $1 AND deleted_at IS NOT NULL
)::boolean;

-- name: LockOwner :one
-- The lock puts two deletes of the same account in sequence.
SELECT id FROM owners WHERE firebase_uid = $1 AND deleted_at IS NULL FOR UPDATE;

-- name: AnonymizeOwner :exec
-- RN-03: o tutor fica com o nome "Conta excluída", um e-mail sem dono e a
-- data da exclusão.
UPDATE owners
SET name = 'Conta excluída', email = 'deleted-' || id || '@nupii.invalid', deleted_at = now()
WHERE id = $1;

-- name: UpdateOwnerName :one
UPDATE owners SET name = $2 WHERE firebase_uid = $1 AND deleted_at IS NULL
RETURNING *;
