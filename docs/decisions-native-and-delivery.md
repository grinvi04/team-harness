# native 전환·제품 경계·소비 인수 결정

[현재 결정 목록](decisions.md)과 함께 읽는다. 이 문서는 현재 계약과 과거 원문을 연결한다.
당시 후보·실패·대체 관계·release 반증의 전체 기록은
[고정 Git 원문](https://github.com/grinvi04/team-harness/blob/54657b3ef79ab36c3e0877664964356badd3510b/docs/decisions-native-and-delivery.md)에 보존한다.
역사 회귀 검사는 이 원문의 전체 SHA와 SHA-256을 검증한 뒤 기존 판정을 그대로 수행한다.

## 현재 유지하는 결정과 정본

- [제품 방향](product-direction.md)과 [제품 경계](product-boundaries.md)가 현재 정본이다.
  공개 설치 단위는 harness-guard 하나이며 split package는 `installable:false`다.
  filesystem profile·공식 loader 표본 통과를 독립 runtime parity·marketplace 승격으로 확대하지 않는다.
- skill 로딩·hook lifecycle·sandbox·permission·subagent 실행은 native-first로 위임한다.
  [플랫폼 중복 감사](platform-overlap-audit.md)와 [native 계약](../plugins/harness-guard/codex/native-runtime.md)을 따른다.
  loader 복제·상시 cache patch·custom resolver를 현재 지원으로 되살리지 않는다.
- [공개 안전성 감사](public-safety-audit.md)의 민감정보·라이선스·secret-scan 경계와
  [개발 조정](development-coordination.md)의 scoped 인계·독립 검증 계약을 유지한다.
- 가드·DDL 정적 검사·required CI·PR/commit/release gate를 유지한다. 정상 사례만으로
  거부 경계를 보장하지 않으며 parser·경로·심볼릭 링크·중첩 실행의 누락은 당시 반증과 구분한다.
  [DB 기준](db-standards.md)과 [코드 리뷰](code-review.md)가 현재 사용 계약이다.
- binary trust는 버전·SHA-256·독립 서명과 실행 직전 바이트 연속성을 함께 확인한다.
  operator-approved exact revision, 격리 환경, credential 전송·감사로그·정확한 보호 정책 검사를 유지한다.
  누락·불일치·조회 실패를 성공으로 바꾸지 않는다. [릴리즈 계약](harness-maintenance.md)을 따른다.
- 외부 provenance는 immutable GitHub 원문과 현재 checkout의 digest 재계산에 결박한다.
  [manifest](pilots/external-pilot-provenance.json)의 JSON 7개는 현재 필수 검증 자산으로 보존한다.
  과거 보고서를 Git으로 옮겨도 release-check의 live 조회·로컬 바이트 대조를 생략하지 않는다.
- [기존 거버넌스 역사](product-direction-governance-history.md)의 split runtime WAIT와
  미승격 경계는 유지한다. platform 연결 surface가 없다는 기록은 새로운 실행 권한이 아니다.
- [소비 인수 역사](product-direction-consumer-history.md)와
  [현재 인수·보류 원문](pilots/consumer-readiness-2026-10-07.md)을 함께 읽는다.
  배포 제외 로컬 QA·develop CI 인수 완료와 전체 보안 감사 FAIL을 구분한다.
  DriveTree·siku·ERP trusted 실제 전환, 원격 기능·운영 배포와 유료 환경 보류는 그대로 남는다.
  과거 파일럿의 zero-drift는 현재 전체 도입·출시 준비 완료를 뜻하지 않는다.

## 원문 복구

삭제·축약 전 바이트의 SHA-256은
`46e60e1c5f507e5b1d89c85c8906f840f81dd28c919a34f39b2542e50b654d5f`이다.

```bash
git --no-replace-objects show \
  54657b3ef79ab36c3e0877664964356badd3510b:docs/decisions-native-and-delivery.md \
  > /tmp/decisions-native-and-delivery.md
shasum -a 256 /tmp/decisions-native-and-delivery.md
```

원문 누락·digest 불일치는 실패다. 현재 정책을 읽을 때 위 정본을 사용하고
과거 후보·거부 계약·수정 이유를 확인할 때 고정 원문을 사용한다.
