# 코드리뷰·커밋·PR 컨벤션

머지 **절차**는 `pr-review-gate` 스킬(플러그인)이 단일 출처 — 이 문서는 **내용 기준**을 정한다.

보호 적용은 모든 사전 조회·유효한 필수 검사 확인 후 시작한다. 조회 오류·빈 검사 집합으로 기존 보호를 약화하지 않는다.

## 커밋 메시지 — Conventional Commits + team-harness 규칙

아래는 개인 기본 규약이다. 회사는 기존 validator와 언어를 유지하고 필요한 기술 자산만
[선택형 온보딩](company-onboarding.md)으로 연결한다. 한국어 규칙 채택은 필수가 아니다.

```text
feat(order): 월 주문 한도 검증 추가

이유: 한도 초과 주문이 결제 단계까지 진행되는 것을 방지
영향: 주문 생성 API
검증: 주문 서비스 테스트 통과
```

Conventional Commits 1.0.0의 `<type>[optional scope][!]: <description>` 구조를 유지하면서, AI와 사람이
같이 읽기 쉽도록 다음 팀 규칙만 추가한다.

- 타입: `feat` `fix` `refactor` `perf` `test` `docs` `style` `chore` `ci` `build` `revert`
- `feat|fix|refactor|perf|test`는 scope 필수. scope는 `order`, `inventory`, `auth` 같은 짧은 도메인·모듈명이다.
- 헤더는 앞뒤 공백 없이 100자 이하다. 요약은 한글을 포함하고 50자 이하이며 마침표로 끝내지 않는다.
- `feat|fix|refactor|perf`는 빈 줄 뒤 `이유:`가 필수다. `영향:`과 `검증:`은 실제로 전달할 정보가 있을 때만
  `이유:` 다음에 이 순서로 추가한다. 구현 방법을 본문에 반복하지 않는다.
- breaking change는 표준대로 `feat(api)!:` 또는 `BREAKING CHANGE:` footer 중 하나로 표시한다.
  둘을 중복할 필요는 없으며 footer 각 줄은 100자 이하다.
- Git 기본 merge 메시지는 로컬 `MERGE_HEAD` 또는 CI의 2개 이상 parent commit으로 provenance가 확인될 때만
  허용한다. 메시지 모양만 흉내 낸 일반 commit은 거부한다. 기본 `Revert "..."`는 1-parent 메시지만으로 실제
  revert 여부를 증명할 수 없어 예외로 두지 않으며, `revert(order): 주문 한도 변경 되돌림`처럼 규약을 따른다.

Node.js가 있는 환경에서는 `commit-msg` 훅이 로컬에서 즉시 검사하고, PR의 `commitlint-trusted`가 기본 브랜치의 validator로
다시 검사한다. non-Node 소비 repo의 개발 환경에 Node.js가 없으면 훅은 경고 후 로컬 검사를 건너뛰며,
PR의 필수 CI가 규칙을 강제한다. `--no-verify`로 로컬 훅을 건너뛰어도 CI 규칙은 그대로 남는다.

PR 자체가 검사 코드를 바꾸는 경계는 [신뢰 원본 커밋 검사 전환](specs/trusted-commitlint.md)으로
보완한다. 새 `commitlint-trusted`는 기본 브랜치 코드를 사용하고 PR의 Git metadata만 읽는다.
기존 필수 검사 교체 여부는 해당 저장소의 실제 branch protection과 연결 PR에서 확인한다.
main 대상 release PR은 보호된 develop에서 이미 도달 가능한 이력을 제외하고 PR 고유 커밋만 검사한다.
실제 main 범위가 있으나 고유 커밋이 없는 `release/*`의 순수 전달은 상위 검사 이력으로 판정한다.
진짜 빈 범위·조회 실패·다른 브랜치·새 규약 위반은 거부하며 [수정 계약](specs/commitlint-gitflow-forward.md)을 따른다.
develop 대상 `sync/backmerge-*` PR도 보호된 main 이력을 제외하되, 충돌 해결처럼 main 밖에서 새로 생긴
고유 커밋은 같은 규칙으로 검사한다. 고유 커밋이 없는 순수 역병합은 재검사 없이 통과한다.

## 브랜치

`feature/{이슈번호}-{슬러그}` · `fix/{이슈번호}-{슬러그}` · `hotfix/{슬러그}` · `release/v{버전}`
(예: `feature/142-order-limit`) — main/develop 직접 커밋은 3겹 가드가 차단

## PR 규칙

PR base는 명시 인자와 제품의 채택 선언을 대조하고 원격에서 확인한다. [선언 형식·거부 조건](company-policy.md#pr-대상-브랜치-선언)을 따른다.

- **작게**: 리뷰 가능한 단위 ±400라인 가이드 (마이그레이션·자동생성 제외) — 넘으면 분리 우선 검토
- 템플릿(`templates/PULL_REQUEST_TEMPLATE.md`) 필수 작성, 미완성 공유는 **Draft**로
- 진행 문서 검사 채택 repo는 PR 본문에 [동기화 선언](ai-collaboration.md#선언한-문서의-기계적-검사)을 연결한다. team-harness 자체 quality는 이를 필수 검사한다. 선언의 대상 누락·근거 의미·비적용 이유는 리뷰어가 diff와 대조한다.
- **셀프 리뷰 먼저**: 본인이 diff를 한 번 훑고 나서 리뷰 요청 (AI 생성 코드는 특히 — `ai-collaboration.md`)
- 현재 head의 비어 있지 않은 required 검사 집합 성공 + 리뷰 스레드 resolve + 회사의 사람 승인·CODEOWNERS를 모두 확인한다.
- 회사 경로가 기본이다. 리뷰어 부재는 승인 삭제·solo 전환의 근거가 아니다. 기존 승인 수·제한을 보존한다.
- 개인 소유·협업자 1명인 repo만 `.harness-policy.json`의 `mode: "solo"`로 명시 선택하고,
  승인된 보호 예외를 `/solo-merge`로 실행할 수 있다. 선언·실제 소유/협업자·CI를 보호 변경 전에 확인한다.
  SIGKILL·전원 손실의 복구를 보장하지 않으며 회사 repo에는 적용하지 않는다.
- `pr-merge.sh --auto`는 `autoMergeTargets: ["develop"]`를 명시한 repo의 develop만 허용한다.
  회사의 승인·CI·플랫폼 권한을 대신하지 않는다. main/release는 자동머지 대상이 아니다.
- 선택과 보호 보존의 JSON·preview·현재 한계는 [회사 정책 안내](company-policy.md)를 따른다.
- 리뷰 SLA: **1영업일** — 지연 시 리뷰어 재지정

## Git Flow 순서 검사 — team-harness 자체 전달

이 repo는 문서만 바뀌어도 **작업 PR → develop 병합 → release 전달 → main 병합 → develop 역병합**을 따른다.
작업 PR과 그 결과를 전달하는 main PR을 동시에 열지 않는다. 생성·병합 전에 다음 근거를 원본에서 검사하고
기존 PR/실행 기록에 연결한다. 조회·명령 실패나 관계 불일치는 다음 단계 중단이며 자체 면제할 수 없다.

- **develop:** 작업 브랜치의 PR base가 develop인지 확인하고 기존 품질·독립 리뷰·보호 게이트를 통과한다.
- **main PR 생성:** 선행 develop PR의 `state=MERGED`·실제 `mergeCommit.oid`를 GitHub에서 읽는다.
  원격 develop을 fetch하고 `git merge-base --is-ancestor <병합SHA> origin/develop` 성공을 확인한다.
  그 확인된 병합 SHA에서 `release/` 브랜치를 만든다. 태그 없는 문서 전달은 `release/docs-<식별자>`를 쓴다.
- **main 병합:** PR head가 위 develop 병합 SHA를 포함하는지 같은 ancestry 검사로 확인한다.
  PR base=main·head=`release/`와 현재 head/base의 리뷰·CI를 확인한다. 오래된 동시 PR의 검증을 재사용하지 않는다.
- **develop 역병합:** main PR의 실제 MERGED SHA가 원격 main에 포함됨을 확인한 뒤 그 SHA에서
  `sync/backmerge-*` PR을 만든다. develop 병합 후 main 병합 SHA의 포함 관계를 다시 확인한다.

일반 래퍼의 CI·리뷰·후보 결박은 이 선행 단계 검사를 대신하지 않는다. 이 절은 실행자의 필수 검사 계약이며
새 서버 보호의 자동 강제를 주장하지 않는다. 정식 버전 릴리즈의 사전 검사·태그·역병합은 기존 release 계약을 따른다.
긴급 장애의 hotfix는 기존 별도 경로다. 절차 변경은 이유·영향·검사와 사용자 승인을 먼저 기록해야 한다.

## 리뷰 관점 체크리스트 (리뷰어용)

우선순위 순 — 위에서 막히면 아래는 보지 않아도 된다:

1. **정확성**: 요구사항 충족? 경계값·동시성·트랜잭션 경계? 에러 경로?
2. **경계 준수**: 프로젝트가 선택한 모듈·계층·데이터 소유 경계를 지키는가?
   ArchUnit 같은 검사를 연결했다면 실제 실행 결과도 확인한다. 스키마 간 조인은 선택한 데이터 계약으로 판단한다.
3. **테스트**: 명세를 검증하나(구현 복사 아닌)? 실패 케이스 있나? domain 로직에 단위 테스트?
4. **보안**: 입력 검증? 권한 코드 검사 누락? 데이터 스코프 필터? 개인정보 로그 출력?
5. **DB**: 마이그레이션 forward-only·무중단 호환? 인덱스? N+1?
6. **일관성**: 선택한 API 응답 형식·에러 코드·이름 규칙과 구현이 일치하는가?
7. **문서 현행화**: 관련 로드맵·체크리스트·진행·사용 안내가 현재 변경·검사·미해결 항목과 일치하고 갱신 근거가 연결됐는가?

설계·도메인 적합성의 사람 리뷰 책임은 유지한다. AI 1차 리뷰는 구현자와 다른 읽기 전용 인스턴스가
현재 PR head/base·원래 요구·직접 소비 계약·검사 증거를 확인한다. **Codex native 리뷰를 우선**하며
사용자가 선택한 다른 도구에도 같은 계약을 적용한다. 실행 미확인은 리뷰 완료가 아니다.
도구 선택·지적 처리·resolve·머지 절차는 `pr-review-gate` 스킬을 따른다. AI 리뷰는 사람 승인을 대체하지 않는다.

## 테스트 깊이 — 렌더 스모크 ≠ 기능 테스트

더미·목 세션 e2e는 백엔드가 401을 주면 화면 셸만 graceful 폴백으로 렌더해 **통과**한다 — 실데이터
크래시·데이터 정합성 버그를 전부 놓친다(실제 사례: 한 화면이 실데이터에서 크래시해 레코드가 통째로
비가시였으나 더미세션 스모크는 그린이었다).

- **규칙**: 인증·데이터에 의존하는 기능은 **실 IdP 인증 세션 + 실 백엔드 데이터**로 구동하는 통합
  e2e를 별도 게이트(env 플래그)로 두고, CRUD·워크플로·합계가 끝까지 도는지 단언한다. 머지 전 권장.

## 실스택 품질감사 (릴리즈·대규모 점검 시)

코드 정독만으로는 부족하다 — 실제로 구동해야 드러나는 결함이 있다.

1. 인프라 클린 재기동(`docker compose down`/`up`) + 실 인증으로 **전 화면을 실제 구동·상호작용**한다
2. 결함을 Tier 0(출시 차단)~3(polish)로 인벤토리화한다
3. **수정 전 실패(RED) 테스트로 버그를 박제**한 뒤 GREEN으로 만든다
4. 작은 응집 PR로 분리한다

## 리뷰 코멘트 컨벤션 (Conventional Comments)

| 접두어 | 의미 | 머지 차단 |
|---|---|---|
| `issue:` | 수정 필요한 문제 | ✅ 차단 |
| `question:` | 의도 확인 (답변 필요) | ✅ 차단 |
| `suggestion:` | 개선 제안 (수용 선택) | ❌ |
| `nit:` | 사소한 스타일 | ❌ |
| `praise:` | 잘한 점 (적극 사용) | ❌ |

- 코드가 아니라 코드에 대해 말한다 — "이 쿼리는 N+1이 발생합니다" (O) / "이걸 왜 이렇게 했어요?" (X)
- `issue:`에는 가능하면 대안 코드를 제시
- 작성자는 모든 스레드에 반영 또는 근거 reply 후 resolve — 무응답 resolve 금지

## 리뷰어 배정

- 기본: 해당 도메인 모듈 주담당 1명 (모듈별 주담당은 팀 구성 시 지정)
- 권한·금액 계산·마이그레이션 변경: 주담당 + 리드 (2인)

## 검토 후보·보호 복원·태그 연결

`pr-merge.sh`는 수동·자동 모두 required 검사 없음·조회 실패·현재 head 미확인 시 병합하지 않는다.
push/PR의 같은 이름 중복은 모든 rollup 행 성공과 최신 REST head/app 증거를 함께 요구한다.
같은 head의 성공 run만으로 현재 서버 필수 검사 전체를 확인했다고 보고하지 않는다.

리뷰 snapshot의 head/base OID를 `pr-merge.sh` 또는 `solo-merge.sh`의 `--expected-head`·
`--expected-base-oid`로 전달한다. wrapper 시작 전후 변경과 조회 실패는 재검토 대상이다.
snapshot helper와 wrapper는 실제 원격 base ref를 읽는다. PR의 `baseRefOid`는 낡은 값일 수 있다.
merge의 공식 `--match-head-commit`은 검증 head를 결박한다. base 재조회는 서버의 원자적 비교가 아니므로
strict required CI와 protected base 정책이 계속 필요하다. 처리한 snapshot thread만 원래 코멘트에 답변·해결한다.

solo 예외는 별도 승인 범위에서 리뷰 요건만 바꾸며, 정상 성공에는 저장한 전체 정책과 실제 복원 응답의 일치가 필요하다.
trap은 복구 시도이며 SIGKILL·전원 손실·API 실패에서 복원 보장을 하지 않는다. 표준 `--check`는 예외의 원값 복원 증명이 아니다.
긴급 수정 태그는 PR의 실제 merge SHA에 생성하고 해당 ref만 push한다. 최신 main이나 모든 로컬 태그를 발행하지 않는다.
