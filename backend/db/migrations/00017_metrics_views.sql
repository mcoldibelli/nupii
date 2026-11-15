-- +goose Up
-- #303: os números do negócio e da fila de tarefas para o Grafana (ADR 0032).
-- As views só têm contagens: nenhum nome, e-mail, telefone, ponto ou foto. O
-- papel metrics_reader do Grafana lê só este schema (deploy/postgres/metrics-reader.sql).
CREATE SCHEMA metrics;

CREATE VIEW metrics.totals AS
SELECT
    (SELECT count(*) FROM owners WHERE deleted_at IS NULL) AS owners,
    (SELECT count(*) FROM pets WHERE deleted_at IS NULL) AS pets,
    (SELECT count(DISTINCT n.pet_id)
     FROM noseprints AS n
     JOIN pets AS p ON p.id = n.pet_id
     WHERE p.deleted_at IS NULL) AS pets_with_noseprint,
    (SELECT count(*) FROM reports WHERE status = 'open' AND type = 'lost') AS open_lost,
    (SELECT count(*) FROM reports WHERE status = 'open' AND type = 'found') AS open_found,
    (SELECT count(*) FROM health_events) AS health_events,
    (SELECT count(*) FROM share_links WHERE revoked_at IS NULL AND expires_at > now()) AS active_card_links;

-- The noseprints of each vector version: another version is out of the search (RN-10, RN-67).
CREATE VIEW metrics.noseprints_by_version AS
SELECT n.model_version, count(*) AS noseprints
FROM noseprints AS n
JOIN pets AS p ON p.id = n.pet_id
WHERE p.deleted_at IS NULL
GROUP BY n.model_version;

CREATE VIEW metrics.signups_daily AS
SELECT date_trunc('day', created_at) AS day, count(*) AS owners
FROM owners
GROUP BY 1;

-- The identifications stay 30 days (RN-42).
CREATE VIEW metrics.identifications_daily AS
SELECT
    date_trunc('day', i.created_at) AS day,
    count(*) AS identifications,
    count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM identification_candidates AS c
        WHERE c.identification_id = i.id AND c.confirmed_at IS NOT NULL)) AS confirmed,
    count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM identification_candidates AS c
        WHERE c.identification_id = i.id)) AS without_candidate
FROM identifications AS i
GROUP BY 1;

CREATE VIEW metrics.reports_daily AS
SELECT date_trunc('day', created_at) AS day, type, count(*) AS reports
FROM reports
GROUP BY 1, 2;

CREATE VIEW metrics.notifications_daily AS
SELECT date_trunc('day', created_at) AS day, kind, push_status, count(*) AS notifications
FROM notifications
GROUP BY 1, 2, 3;

-- The queue of tasks (ADR 0003): a pending task 5 minutes after its time is late.
CREATE VIEW metrics.jobs AS
SELECT
    kind,
    status,
    count(*) AS jobs,
    count(*) FILTER (WHERE status = 'pending' AND run_at < now() - interval '5 minutes') AS late,
    coalesce(max(attempts), 0) AS max_attempts
FROM jobs
GROUP BY kind, status;

-- +goose Down
DROP SCHEMA metrics CASCADE;
