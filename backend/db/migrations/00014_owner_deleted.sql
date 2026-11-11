-- +goose Up
-- RN-04: uma conta excluída recebe 401. The row stays: the pets and the
-- reports of the owner point to it.
ALTER TABLE owners ADD COLUMN deleted_at timestamptz;

-- +goose Down
ALTER TABLE owners DROP COLUMN deleted_at;
