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

-- name: ListNoseprintsOfOtherVersions :many
-- RN-67: os cadastros de outra versão do modelo, de pets não excluídos.
SELECT n.id, n.image_key, n.model_version
FROM noseprints AS n
JOIN pets AS p ON p.id = n.pet_id
WHERE n.model_version <> sqlc.arg(model_version) AND p.deleted_at IS NULL
ORDER BY n.id;

-- name: UpdateNoseprintEmbedding :execrows
-- The update does nothing when another recompute changed the noseprint.
UPDATE noseprints
SET embedding = sqlc.arg(embedding)::text::vector,
    model_version = sqlc.arg(model_version),
    quality = sqlc.arg(quality)
WHERE id = sqlc.arg(id) AND model_version = sqlc.arg(previous_model_version);

-- name: SearchNoseprints :many
-- RN-10: a busca lê os 50 cadastros mais parecidos pelo cosseno, só da mesma
-- versão do modelo. RN-11: ficam fora da busca os pets excluídos.
SELECT
    n.id AS noseprint_id,
    n.pet_id,
    (1 - (n.embedding <=> sqlc.arg(embedding)::text::vector))::float8 AS similarity
FROM noseprints AS n
JOIN pets AS p ON p.id = n.pet_id
WHERE n.model_version = sqlc.arg(model_version) AND p.deleted_at IS NULL
ORDER BY n.embedding <=> sqlc.arg(embedding)::text::vector
LIMIT 50;

-- name: CountGalleryPets :one
-- RN-15: o tamanho do acervo é o número de pets que entram na busca.
SELECT count(DISTINCT n.pet_id)
FROM noseprints AS n
JOIN pets AS p ON p.id = n.pet_id
WHERE n.model_version = sqlc.arg(model_version) AND p.deleted_at IS NULL;

-- name: CreateIdentification :one
-- The location is NULL when the latitude or the longitude is NULL.
INSERT INTO identifications (model_version, location)
VALUES (
    sqlc.arg(model_version),
    ST_SetSRID(
        ST_MakePoint(sqlc.narg(longitude)::float8, sqlc.narg(latitude)::float8), 4326
    )::geography
)
RETURNING id;

-- name: CreateIdentificationCandidate :one
INSERT INTO identification_candidates (identification_id, noseprint_id, pet_id, rank, similarity)
VALUES (
    sqlc.arg(identification_id),
    sqlc.arg(noseprint_id),
    sqlc.arg(pet_id),
    sqlc.arg(rank),
    sqlc.arg(similarity)
)
RETURNING id;

-- name: ListCandidatePets :many
-- RN-62: o candidato tem só o nome e a foto de perfil do pet.
SELECT p.id, p.name, p.photo_key
FROM pets AS p
WHERE p.id = ANY(sqlc.arg(ids)::uuid[]);

-- name: LockCandidate :one
-- RN-64: o candidato da confirmação é da mesma identificação. The lock of
-- the identification puts two confirmations in sequence.
SELECT c.id, i.photo_key, p.owner_id, p.name AS pet_name
FROM identification_candidates AS c
JOIN identifications AS i ON i.id = c.identification_id
JOIN pets AS p ON p.id = c.pet_id
WHERE c.id = sqlc.arg(candidate_id) AND i.id = sqlc.arg(identification_id)
FOR UPDATE OF i;

-- name: SetIdentificationContact :exec
-- RN-65: confirmar de novo muda só o contato. A foto fica a da primeira
-- confirmação que envia uma foto.
UPDATE identifications
SET contact_name = sqlc.arg(contact_name),
    contact_phone = sqlc.arg(contact_phone),
    contact_message = sqlc.narg(contact_message),
    photo_key = COALESCE(photo_key, sqlc.narg(photo_key))
WHERE id = sqlc.arg(id);

-- name: ConfirmCandidate :execrows
-- RN-65: a data da confirmação fica a da primeira vez.
UPDATE identification_candidates
SET confirmed_at = now()
WHERE id = sqlc.arg(id) AND confirmed_at IS NULL;

-- name: ListFoundNotices :many
-- RN-66: os avisos vêm do mais novo para o mais antigo.
SELECT
    c.id,
    c.pet_id,
    p.name AS pet_name,
    i.contact_name,
    i.contact_phone,
    i.contact_message,
    (i.location IS NOT NULL)::boolean AS has_location,
    COALESCE(ST_Y(i.location::geometry), 0)::float8 AS latitude,
    COALESCE(ST_X(i.location::geometry), 0)::float8 AS longitude,
    c.confirmed_at
FROM identification_candidates AS c
JOIN identifications AS i ON i.id = c.identification_id
JOIN pets AS p ON p.id = c.pet_id
WHERE p.owner_id = sqlc.arg(owner_id) AND p.deleted_at IS NULL AND c.confirmed_at IS NOT NULL
ORDER BY c.confirmed_at DESC, c.id DESC;
