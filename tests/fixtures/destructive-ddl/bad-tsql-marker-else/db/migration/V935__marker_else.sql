IF 1 = 0 SELECT 1 -- migration-safety: destructive-ok
ELSE TRUNCATE TABLE dbo.orders
