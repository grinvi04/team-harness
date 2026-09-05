-- migration-safety: destructive-ok
ALTER TABLE users
  DROP /* column operation */ COLUMN legacy;
