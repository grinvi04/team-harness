# 코드리뷰·커밋·PR 컨벤션

머지 **절차**는 `pr-review-gate` 스킬(플러그인)이 단일 출처 — 이 문서는 **내용 기준**을 정한다.

## 커밋 메시지 — Conventional Commits (타입 영어 + 본문 한국어, 확정)

```
feat(order): 월 주문 한도 검증 추가

한도 초과 시 ORDER_LIMIT_EXCEEDED(409) 반환.
기준정보 모듈의 한도 설정을 참조한다.
```

- 타입: `feat` `fix` `refactor` `test` `docs` `chore` `perf` / scope = **도메인 모듈명** (`order`, `inventory`)
- 제목 50자 내외, 마침표 없음 / 본문은 "무엇을·왜" (어떻게는 diff가 말한다)
- breaking change는 `feat(order)!:` + 본문에 `BREAKING CHANGE:` 명시

## 브랜치

`feature/{이슈번호}-{슬러그}` · `fix/{이슈번호}-{슬러그}` · `hotfix/{슬러그}` · `release/v{버전}`
(예: `feature/142-order-limit`) — main/develop 직접 커밋은 3겹 가드가 차단

## PR 규칙

- **작게**: 리뷰 가능한 단위 ±400라인 가이드 (마이그레이션·자동생성 제외) — 넘으면 분리 우선 검토
- 템플릿(`templates/PULL_REQUEST_TEMPLATE.md`) 필수 작성, 미완성 공유는 **Draft**로
- **셀프 리뷰 먼저**: 본인이 diff를 한 번 훑고 나서 리뷰 요청 (AI 생성 코드는 특히 — `ai-collaboration.md`)
- CI 통과 + 리뷰 스레드 전부 resolve = 공통 머지 조건 (branch protection 강제). **승인**은 조건부 — **팀 모드**(리뷰어 有)는 사람 승인 1명 이상, **솔로 표준**은 승인요건 0이라 CI-gate·enforce_admins=on이 대신한다(아래 "솔로/리뷰어 부재" 참조)
- **솔로/리뷰어 부재**: 자기 PR 자기승인이 불가하므로 승인요건 충족이 구조적으로 막힌다. 두 운용을 **자유롭게 선택**한다(품질 게이트=CI·스레드 resolve는 항상 유지):
  - (a) **승인요건 유지 + `/solo-merge`**: 머지할 때만 승인요건을 일시 우회·즉시 복구. 리뷰 흐름을 언제든 다시 쓸 수 있게 보존. 반복 마찰을 줄이려면 한 줄 별칭(`sm <PR>`) 권장 — AI는 보호 토글이 분류기에 막혀 사람이 실행.
  - (b) **승인요건 제거 + CI 게이트만**: `required_pull_request_reviews` 삭제 → 그 뒤 **`pr-merge.sh`(게이트 래퍼)로 머지**(AI도 가능 — 맨손 `gh pr merge`는 guard가 차단하므로 래퍼가 CI·스레드·mergeable 검증 후 머지). 리뷰어 합류 시 `required_approving_review_count`로 복구 — 이 복구/설정은 `set-branch-protection.sh <repo> --approvals N`(main에만 승인 N + `dismiss_stale_reviews`, develop은 0 유지)으로 한다.
  - **main(릴리즈)은 보호 유지 권장** — 머지가 드물고 운영 배포 대상이라 게이트 한 겹이 안전.
  - **develop 자동머지(개선2)**: develop CI-green PR은 `bash pr-merge.sh --auto <PR>`로 **분류기 프롬프트 없이** 머지한다(settings `Bash(bash * pr-merge.sh --auto *)` allow-rule이 분류기를 우회). `--auto`는 **base=develop만** 허용하고 main base는 거부(exit 3)하므로 자동승인돼도 main은 못 뚫는다 — **안전 1차 보증은 스크립트의 base 강제**(allow-rule 매처는 마찰감소, fragile해도 최악=분류기 폴백). enforce_admins=true로 CI가 서버 강제라 develop 자동의 남은 리스크는 "의도"뿐(revertable). **main/release는 --auto 대상 아님** — /release·/hotfix로 확인 유지. 단일 출처: `docs/specs/develop-auto-merge.md`.
- 리뷰 SLA: **1영업일** — 지연 시 리뷰어 재지정

## 리뷰 관점 체크리스트 (리뷰어용)

우선순위 순 — 위에서 막히면 아래는 보지 않아도 된다:

1. **정확성**: 요구사항 충족? 경계값·동시성·트랜잭션 경계? 에러 경로?
2. **경계 준수**: 모듈 직접 참조 없나? 계층 역류 없나? (ArchUnit이 1차, 리뷰는 설계 의도 확인)
   크로스 스키마 조인 없나?
3. **테스트**: 명세를 검증하나(구현 복사 아닌)? 실패 케이스 있나? domain 로직에 단위 테스트?
4. **보안**: 입력 검증? 권한 코드 검사 누락? 데이터 스코프 필터? 개인정보 로그 출력?
5. **DB**: 마이그레이션 forward-only·무중단 호환? 인덱스? N+1?
6. **일관성**: API envelope·에러 코드·네이밍이 표준 문서와 일치?

설계·도메인 적합성은 사람 리뷰의 본분 — 기계적 버그 스캔은 **Claude Code `/code-review`
스킬**이 PR마다 1차로 수행한다(구독 포함, PR별 API 과금 없음 — 외부 AI 리뷰봇에 의존하지
않는다). 리뷰 처리·resolve 절차는 `pr-review-gate` 스킬을 따른다.

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
