-- migration-safety: destructive-ok
ALTER TABLE users
  ALTER COLUMN kept TYPE text,
  DROP COLUMN legacy,
  DROP COLUMN legacy_two;
