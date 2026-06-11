<!-- 프로젝트 repo의 .github/PULL_REQUEST_TEMPLATE.md 로 복사 -->

## 목적

<!-- 무엇을 왜 바꾸는가. 이슈 링크: Closes #123 -->

## 주요 변경

<!-- 리뷰어가 diff를 읽기 전에 알아야 할 변경 요약 (파일 나열 말고 의도 중심) -->

## AI 사용 내역

<!-- AI에게 준 핵심 지시 요약 (없으면 "직접 작성") — ai-collaboration.md -->

## 검증

<!-- 어떻게 확인했나: 테스트 명령·결과, 수동 확인 절차 -->

## 체크리스트

- [ ] 셀프 리뷰 완료 (diff 직접 훑음, 이해 못 한 코드 없음)
- [ ] 테스트 추가/갱신 (domain 로직 단위 테스트 포함)
- [ ] DB 변경 시: 마이그레이션 forward-only·무중단 호환 (`db-standards.md`)
- [ ] API 변경 시: envelope·에러 코드 표준 준수 (`api-standards.md`)
- [ ] 권한·금액 계산·마이그레이션 변경 시: 리드 리뷰어 추가 지정 (`code-review.md` 배정 규칙)
