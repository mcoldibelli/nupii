-- +goose Up
-- RN-83: o tutor escolhe se a carteirinha do link mostra os exames.
ALTER TABLE share_links ADD COLUMN include_exams boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE share_links DROP COLUMN include_exams;
