-- 공격자가 문자열 값으로 승인 마커를 위장 시도
INSERT INTO settings(k,v) VALUES ('policy','migration-safety: destructive-ok');
DROP TABLE payments;
