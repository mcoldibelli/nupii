-- name: CreatePet :one
INSERT INTO pets (
    owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone
)
VALUES (
    sqlc.arg(owner_id), sqlc.arg(name), sqlc.arg(species), sqlc.narg(breed), sqlc.narg(sex),
    sqlc.narg(size), sqlc.narg(birth_date), sqlc.narg(weight_kg), sqlc.narg(neutered),
    sqlc.narg(vet_name), sqlc.narg(vet_clinic), sqlc.narg(vet_phone)
)
RETURNING id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at;

-- name: ListPets :many
-- The pets of an owner that are not deleted, in name order.
SELECT id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at
FROM pets
WHERE owner_id = sqlc.arg(owner_id) AND deleted_at IS NULL
ORDER BY lower(name), id;

-- name: GetPet :one
-- A pet of another owner, or a deleted pet, gives no row.
SELECT id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at
FROM pets
WHERE id = sqlc.arg(id) AND owner_id = sqlc.arg(owner_id) AND deleted_at IS NULL;

-- name: UpdatePet :one
-- Replaces all the data of a pet of the owner.
UPDATE pets
SET name = sqlc.arg(name),
    species = sqlc.arg(species),
    breed = sqlc.narg(breed),
    sex = sqlc.narg(sex),
    size = sqlc.narg(size),
    birth_date = sqlc.narg(birth_date),
    weight_kg = sqlc.narg(weight_kg),
    neutered = sqlc.narg(neutered),
    vet_name = sqlc.narg(vet_name),
    vet_clinic = sqlc.narg(vet_clinic),
    vet_phone = sqlc.narg(vet_phone),
    updated_at = now()
WHERE id = sqlc.arg(id) AND owner_id = sqlc.arg(owner_id) AND deleted_at IS NULL
RETURNING id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at;

-- name: DeletePet :execrows
-- Logical delete: the row stays, with the date of the delete.
UPDATE pets
SET deleted_at = now(), updated_at = now()
WHERE id = sqlc.arg(id) AND owner_id = sqlc.arg(owner_id) AND deleted_at IS NULL;
