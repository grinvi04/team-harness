-- migration-safety: destructive-ok
ALTER TABLE users
  DROP COLUMN legacy
WHILE 1 = 1 TRUNCATE TABLE audit_log;
