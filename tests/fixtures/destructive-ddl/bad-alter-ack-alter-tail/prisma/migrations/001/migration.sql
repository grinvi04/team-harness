-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy
ALTER TABLE audit_log DROP COLUMN message;
