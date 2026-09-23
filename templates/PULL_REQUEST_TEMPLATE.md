<!-- 프로젝트 repo의 .github/PULL_REQUEST_TEMPLATE.md 로 복사 -->

## 목적

<!-- 무엇을 왜 바꾸는가. 이슈 링크: Closes #123 -->

## 주요 변경

<!-- 리뷰어가 diff를 읽기 전에 알아야 할 변경 요약 (파일 나열 말고 의도 중심) -->

## AI 사용 내역

<!-- AI에게 준 핵심 지시 요약 (없으면 "직접 작성") — ai-collaboration.md -->

## 검증

<!-- 어떻게 확인했나: 테스트 명령·결과, 수동 확인 절차 -->

## 진행 문서 동기화

<!-- 검사 채택 repo: ai-collaboration.md의 harness-doc-sync fence로 기존 작업 스펙의 record 경로 또는
실제 documents/items를 선언. 영향이 없으면 구체적인 noImpact 사유. 이 주석 자체는 선언이 아니다.
검사 통과는 미선언 대상·문서 의미·근거 진실까지 보장하지 않으므로 리뷰에서 diff와 대조한다. -->

## 체크리스트

- [ ] 셀프 리뷰 완료 (diff 직접 훑음, 이해 못 한 코드 없음)
- [ ] 관련 로드맵·체크리스트·진행·사용 문서 현행화 (검증 절에 갱신 경로·상태 근거, 영향 없으면 이유)
- [ ] 테스트 추가/갱신 (domain 로직 단위 테스트 포함)
- [ ] DB 변경 시: 마이그레이션 forward-only·무중단 호환 (`db-standards.md`)
- [ ] API 변경 시: envelope·에러 코드 표준 준수 (`api-standards.md`)
- [ ] 권한·금액 계산·마이그레이션 변경 시: 리드 리뷰어 추가 지정 (`code-review.md` 배정 규칙)
