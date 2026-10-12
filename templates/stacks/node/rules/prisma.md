---
paths: ["**/prisma/**", "**/schema.prisma"]
---

# Prisma 작업 규칙

프로젝트의 Prisma·DB·driver adapter 버전과 연결 환경을 확인한다.
공통 계약은 `docs/db-standards.md`, 진단은 `docs/stack-troubleshooting-database.md`를 따른다.

## 생성과 적용

- 개발용 migrate dev와 운영용 migrate deploy를 구분한다. MongoDB 등 도구 비적용도 확인한다.
- 미적용 초안은 생성 후 검토·수정할 수 있다. 공유·적용한 파일은 원본을 보존한다.
- client 생성·타입 검사·적용은 프로젝트의 실제 경로와 명령으로 연결한다.
- migrate deploy가 자동 실행된다고 가정하지 않는다. 실제 배포 구성을 확인한다.

## 실패와 안전 경계

`migrate resolve --rolled-back`은 이력 표시 변경이다. 실행된 SQL을 되돌리지 않는다.
부분 적용·실패 로그·데이터 영향을 확인하고 승인된 보정·복구 계획을 따른다.
`migrate reset`은 전체 데이터 삭제이므로 실패의 기본 대응으로 사용하지 않는다.
raw SQL은 파라미터를 바인딩한다. $queryRawUnsafe에 비신뢰 값을 전달하지 않는다.
소프트 삭제 extension의 nested write·관계 조회·raw 경로는 별도로 검사한다.
client 생성·재사용·pool 크기는 장기 실행과 serverless 환경의 차이를 확인한다.

공식 자료: [운영 복구](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing),
[미적용 초안 편집](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations).
