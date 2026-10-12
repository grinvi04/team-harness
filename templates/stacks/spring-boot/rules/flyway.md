---
paths: ["**/resources/db/migration/**"]
---

# Flyway 마이그레이션 작업 규칙

지원 버전과 실제 위치·설정·실행 명령은 프로젝트에서 확인한다.
공통 계약은 `docs/db-standards.md`, 진단은 `docs/stack-troubleshooting-database.md`를 따른다.

## 작업 순서

새 migration을 만들고 SQL·의존 순서·기존 데이터 영향을 검토한다.
적용한 파일을 수정하지 않는다. checksum 실패는 원본·이력부터 확인한다.
빈 DB의 전체 적용과 이전 상태의 증분 적용을 승인된 격리 DB에서 비교한다.
운영 DB·스냅샷 복사나 clean 명령을 자동 실행하지 않는다.

## 번호와 outOfOrder

outOfOrder를 모든 신규 프로젝트에 켜지 않는다. 기본값과 버전별 동작은 공식 자료에서 확인한다.
낮은 버전의 뒤늦은 적용이 필요하면 migration의 순서 독립성과 두 적용 경로의 결과를 먼저 검증한다.
모듈 번호나 timestamp만으로 독립성·순서 안전성이 증명되지는 않는다.

Harness의 `check-migration-safety.mjs`는 번호 패턴·가장 가까운 config를 정적으로 검사한다.
대역 번호로 판단하면 out-of-order 미설정/false를 거부한다. 실제 SQL의 독립성은 검사하지 않는다.
실제 단조·timestamp 규약이라면 기존 지원 선언 `scheme=monotonic`·`scheme=timestamp`를 근거와 함께 쓴다.
대역 규약은 `scheme=prefix-band`로 명시할 수 있다. 검사를 통과하려고 허위 규약을 선언하지 않는다.
이 동작은 그대로 유지한다. 새로운 번호 규약을 쓰려면 코드·검사와 별도의 변경이 필요하다.

공식 자료: [outOfOrder](https://documentation.red-gate.com/fd/flyway-out-of-order-setting-277579015.html).
`clean-on-validation-error` 등 데이터 삭제 설정으로 실패를 숨기지 않는다.
