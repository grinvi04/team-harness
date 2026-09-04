SELECT $body$
TRUNCATE TABLE orders -- migration-safety: destructive-ok
;
$body$;
