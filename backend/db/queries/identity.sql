-- name: CreateOwner :one
-- Creates the owner of a Firebase user. When the user already has an owner,
-- the statement changes nothing and returns no row.
INSERT INTO owners (firebase_uid, email, name, terms_version, terms_accepted_at)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (firebase_uid) DO NOTHING
RETURNING id, firebase_uid, email, name, terms_version, terms_accepted_at, created_at;

-- name: GetOwnerByFirebaseUID :one
SELECT id, firebase_uid, email, name, terms_version, terms_accepted_at, created_at
FROM owners
WHERE firebase_uid = $1;
