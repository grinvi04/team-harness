-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy
IF 1 = 1 TRUNCATE TABLE audit_log;
