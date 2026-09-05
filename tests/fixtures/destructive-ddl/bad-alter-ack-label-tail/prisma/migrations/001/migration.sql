-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy
again: TRUNCATE TABLE audit_log;
