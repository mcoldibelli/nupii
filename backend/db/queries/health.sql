-- name: CreateHealthEvent :one
INSERT INTO health_events (
    pet_id, type, date, notes, name, vet, manufacturer, batch, dose, next_dose_date,
    clinic, reason, diagnosis, weight_kg, return_date, medication_category,
    active_ingredient, dosage, frequency, end_date, in_use, interval_days, lab, result,
    note_category, title, remind
) VALUES (
    sqlc.arg(pet_id), sqlc.arg(type), sqlc.arg(date), sqlc.narg(notes), sqlc.narg(name),
    sqlc.narg(vet), sqlc.narg(manufacturer), sqlc.narg(batch), sqlc.narg(dose),
    sqlc.narg(next_dose_date), sqlc.narg(clinic), sqlc.narg(reason), sqlc.narg(diagnosis),
    sqlc.narg(weight_kg), sqlc.narg(return_date), sqlc.narg(medication_category),
    sqlc.narg(active_ingredient), sqlc.narg(dosage), sqlc.narg(frequency), sqlc.narg(end_date),
    sqlc.narg(in_use), sqlc.narg(interval_days), sqlc.narg(lab), sqlc.narg(result),
    sqlc.narg(note_category), sqlc.narg(title), sqlc.arg(remind)
)
RETURNING *;

-- name: UpdateHealthEvent :one
UPDATE health_events SET
    type = sqlc.arg(type), date = sqlc.arg(date), notes = sqlc.narg(notes),
    name = sqlc.narg(name), vet = sqlc.narg(vet), manufacturer = sqlc.narg(manufacturer),
    batch = sqlc.narg(batch), dose = sqlc.narg(dose), next_dose_date = sqlc.narg(next_dose_date),
    clinic = sqlc.narg(clinic), reason = sqlc.narg(reason), diagnosis = sqlc.narg(diagnosis),
    weight_kg = sqlc.narg(weight_kg), return_date = sqlc.narg(return_date),
    medication_category = sqlc.narg(medication_category),
    active_ingredient = sqlc.narg(active_ingredient), dosage = sqlc.narg(dosage),
    frequency = sqlc.narg(frequency), end_date = sqlc.narg(end_date), in_use = sqlc.narg(in_use),
    interval_days = sqlc.narg(interval_days), lab = sqlc.narg(lab), result = sqlc.narg(result),
    note_category = sqlc.narg(note_category), title = sqlc.narg(title), remind = sqlc.arg(remind),
    updated_at = now()
WHERE id = sqlc.arg(id) AND pet_id = sqlc.arg(pet_id)
RETURNING *;

-- name: ListHealthEvents :many
SELECT * FROM health_events
WHERE pet_id = sqlc.arg(pet_id)
ORDER BY date DESC, created_at DESC;

-- name: DeleteHealthEvent :execrows
DELETE FROM health_events WHERE id = sqlc.arg(id) AND pet_id = sqlc.arg(pet_id);

-- name: ListUpcomingCare :many
-- RN-81: a próxima dose de uma vacina com a opção de lembrar, e a data de
-- uma medicação em uso com a opção de lembrar, somada ao intervalo. Vale só
-- o evento mais novo de cada vacina pelo nome, e de cada medicação pela
-- categoria (antipulgas, vermífugo) ou pelo nome.
WITH latest AS (
    SELECT DISTINCT ON (e.pet_id, e.type, e.care_key)
        e.id, e.pet_id, e.type, e.name, e.medication_category, e.remind, e.in_use,
        e.next_dose_date, e.date, e.interval_days
    FROM (
        SELECT h.*,
            CASE
                WHEN h.type = 'medication' AND h.medication_category IN ('flea', 'deworm')
                    THEN h.medication_category
                ELSE lower(h.name)
            END AS care_key
        FROM health_events AS h
        JOIN pets AS p ON p.id = h.pet_id
        WHERE p.owner_id = sqlc.arg(owner_id) AND p.deleted_at IS NULL
            AND h.type IN ('vaccine', 'medication')
    ) AS e
    ORDER BY e.pet_id, e.type, e.care_key, e.date DESC, e.created_at DESC
)
SELECT
    l.id, l.pet_id, p.name AS pet_name, l.type, l.name, l.medication_category,
    (CASE WHEN l.type = 'vaccine' THEN l.next_dose_date ELSE l.date + l.interval_days END)::date AS due_date
FROM latest AS l
JOIN pets AS p ON p.id = l.pet_id
WHERE l.remind AND (
    (l.type = 'vaccine' AND l.next_dose_date IS NOT NULL)
    OR (l.type = 'medication' AND l.in_use IS NOT FALSE AND l.interval_days IS NOT NULL)
)
ORDER BY due_date, p.name;
