-- +goose Up
-- RN-42: one purge at each time. A start of the API that writes the same
-- next run changes nothing.
CREATE UNIQUE INDEX jobs_purge_run_key ON jobs (kind, run_at) WHERE kind = 'purge_expired_data';

-- +goose Down
DROP INDEX jobs_purge_run_key;
