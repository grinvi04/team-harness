-- migration-safety: destructive-ok
ALTER TABLE orders DROP COLUMN legacy_memo;
