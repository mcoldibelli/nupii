-- +goose Up
ALTER TABLE pets ADD COLUMN photo_key text;

-- +goose Down
ALTER TABLE pets DROP COLUMN photo_key;
