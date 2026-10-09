---
paths: ["**/alembic/**", "**/alembic.ini", "**/migrations/**"]
---

# Alembic 마이그레이션 작업 규칙

지원 버전·설정·DB 연결·실행 경로를 프로젝트에서 확인한다. 특정 Mac의 환경 경로를 넣지 않는다.
공통 계약은 `docs/db-standards.md`, 진단은 `docs/stack-troubleshooting-database.md`를 따른다.

## 생성과 검토

autogenerate는 후보 생성이다. 적용 전 SQL·rename·제약·데이터 이관·revision 연결을 검토하고 수정한다.
적용한 파일은 수정하지 않는다. 생성된 초안을 수정할 수 없다는 규칙으로 잘못된 SQL을 그대로 적용하지 않는다.
직접 SQL은 바인딩한다. ORM 모델과 실제 스키마·기존 데이터를 대조한다.

## 실패·분기·정적 검사

current·history·heads로 상태를 확인한다. downgrade를 기본 복구 명령으로 실행하지 않는다.
다중 head는 의도한 구조와 충돌을 먼저 확인한다. merge revision만으로 데이터 충돌이 해결되지는 않는다.
단일 head 정책을 채택하면 실행 실패·0개·여러 개를 검사한다.
Harness의 현재 CI는 Alembic 설정이 있는 repo의 설치·heads 실행 실패를 실패로 처리한다.
설정이 없을 때만 해당 heads 검사가 비적용이다. CI 템플릿과 실제 연결을 확인한다.

연결된 `check-alembic-destructive-ddl.mjs`는 upgrade 본문의 알려진 파괴 구문을 검사한다.
helper·동적 SQL·전체 실행을 해석하지 않는다. downgrade 비검출은 실행 허용이나 안전 보장이 아니다.
기존 승인 마커의 문장 범위를 확인한다. 마커는 운영 권한을 만들지 않는다.

공식 자료: [자동 생성 한계](https://alembic.sqlalchemy.org/en/latest/autogenerate.html),
[분기·병합](https://alembic.sqlalchemy.org/en/latest/branches.html).
