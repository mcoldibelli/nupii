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
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at, photo_key;

-- name: ListPets :many
-- The pets of an owner that are not deleted, in name order.
SELECT id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at, photo_key
FROM pets
WHERE owner_id = sqlc.arg(owner_id) AND deleted_at IS NULL
ORDER BY lower(name), id;

-- name: GetPet :one
-- A pet of another owner, or a deleted pet, gives no row.
SELECT id, owner_id, name, species, breed, sex, size, birth_date, weight_kg, neutered,
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at, photo_key
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
    vet_name, vet_clinic, vet_phone, created_at, updated_at, deleted_at, photo_key;

-- name: SetPetPhoto :one
-- Sets the key of the profile photo of a pet of the owner, and returns the
-- key that the pet had. The row lock makes two requests for the same pet
-- run one after the other, so each one gets the key that it replaced.
WITH previous AS (
    SELECT p.id, p.photo_key
    FROM pets AS p
    WHERE p.id = sqlc.arg(id) AND p.owner_id = sqlc.arg(owner_id) AND p.deleted_at IS NULL
    FOR UPDATE
)
UPDATE pets
SET photo_key = sqlc.arg(photo_key), updated_at = now()
FROM previous
WHERE pets.id = previous.id
RETURNING pets.id, pets.owner_id, pets.name, pets.species, pets.breed, pets.sex, pets.size,
    pets.birth_date, pets.weight_kg, pets.neutered, pets.vet_name, pets.vet_clinic, pets.vet_phone,
    pets.created_at, pets.updated_at, pets.deleted_at, pets.photo_key,
    previous.photo_key AS previous_photo_key;

-- name: DeletePet :one
-- Logical delete: the row stays, with the date of the delete and without
-- the key of the photo. Returns the key that the pet had.
WITH previous AS (
    SELECT p.id, p.photo_key
    FROM pets AS p
    WHERE p.id = sqlc.arg(id) AND p.owner_id = sqlc.arg(owner_id) AND p.deleted_at IS NULL
    FOR UPDATE
)
UPDATE pets
SET deleted_at = now(), updated_at = now(), photo_key = NULL
FROM previous
WHERE pets.id = previous.id
RETURNING previous.photo_key AS previous_photo_key;
