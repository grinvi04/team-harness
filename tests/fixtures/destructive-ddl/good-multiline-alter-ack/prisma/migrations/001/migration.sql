-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy;
