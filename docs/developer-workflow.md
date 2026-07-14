# 개발자 워크플로 가이드

> 이 문서는 team-harness를 **사용해 제품 코드를 개발하는 사람**을 위한 길잡이다.
> 처음 설치한다면 [onboarding.md](onboarding.md), 전체 구조를 먼저 보고 싶다면
> [intro.html](intro.html)을 읽는다.

## 1. 이것만 먼저 이해하기

team-harness는 AI에게 일을 맡기는 방법과 Git 작업 절차를 하나의 흐름으로 묶는다.

1. `AGENTS.md`에 프로젝트 규칙과 검증 명령을 적는다.
2. 작업 전에 기대 결과를 정하고, 테스트로 실패를 재현한다.
3. `feature/*` 또는 `fix/*` 브랜치에서만 변경한다.
4. PR은 AI 리뷰, CI, 미해결 스레드 확인을 거쳐 머지한다.
5. `main`과 `develop`의 보호 규칙이 사람과 AI 모두에게 같은 절차를 강제한다.

즉, AI가 코드를 작성할 수는 있지만 **무엇을 만들지 결정하고 결과를 검수할 책임은 개발자에게 있다.**
자세한 책임 원칙은 [AI 협업 가이드](ai-collaboration.md)를 따른다.

## 2. 지금 하려는 일 찾기

| 하려는 일 | 시작 위치 | 사용할 절차 | 완료 결과 |
|---|---|---|---|
| 새 기능 개발 | `develop` | `plan` → `feature-add` | 테스트된 기능 커밋이 `feature/*`에 생성됨 |
| 기존 기능 확장 | `develop` | 필요하면 `plan` → `feature-modify` | 변경 동작은 GREEN, 기존 동작도 유지됨 |
| 버그 수정 | `develop` | `feature-modify` | 재현 테스트와 수정이 `fix/*`에 생성됨 |
| 기능·수정 머지 | `feature/*` 또는 `fix/*` | `feature-merge` | 리뷰·CI 게이트 후 `develop` 반영 |
| 반복되는 CI·lint 수정 | 작업 브랜치 | `loop` | 지정한 검증 명령이 exit 0이 될 때까지 안전하게 반복 |
| 프론트엔드 품질 확인 | 작업 브랜치 | `qa` | 디자인 토큰과 WCAG 2.2 점검 결과 |
| 운영 긴급 수정 | `main` 기준 | `hotfix` | `main` 태그 배포 후 `develop` 역병합 |
| 정식 릴리즈 | `develop` | `release-check` → `release` | `main` 태그 배포 후 `develop` 역병합 |
| 하네스 상태 확인 | 어느 브랜치든 가능 | `harness-doctor.sh` | 로컬 설정·플러그인·repo·브랜치 보호 진단 |

도구 화면에 slash command 입력창이 없다면 skill 이름과 목표를 자연어로 요청해도 된다.
예: “`feature-add` 절차로 주문 취소 기능을 개발해줘.”

## 3. 일반적인 기능 개발 예시

예시 요구사항은 “출고 전 주문만 취소할 수 있게 해줘”다.

### 3.1 작업 전에 의도를 고정한다

복잡하거나 해석이 갈릴 수 있는 기능은 먼저 `plan`을 사용한다.

```text
plan 절차로 주문 취소 기능을 계획해줘.
출고 전 주문만 취소할 수 있고, 이미 출고된 주문은 거절해야 해.
```

AI는 코드부터 만들지 않고 다음 내용을 `docs/specs/` 문서로 정리한다.

- 무엇을 왜 만드는지
- 포함 범위와 비범위
- 정상·예외·경계 수용기준
- 테스트 가능한 작은 구현 태스크

모호한 점이 없어지고 방향을 승인하면 개발 단계로 넘어간다. 오탈자처럼 결과가 자명한 작은 변경에는
별도 plan을 만들지 않아도 된다.

### 3.2 테스트로 기대 동작을 먼저 고정한다

```text
승인한 주문 취소 스펙의 첫 태스크를 feature-add 절차로 구현해줘.
```

`feature-add`는 다음 순서를 따른다.

1. `develop`에서 `feature/*` 브랜치를 만든다.
2. 정상·예외·경계 테스트를 먼저 작성한다.
3. 새 테스트가 올바른 이유로 실패하는지 확인한다(RED).
4. 테스트를 통과시키는 최소 코드를 구현한다(GREEN).
5. 중복을 정리하고 전체 품질 검증을 다시 실행한다.
6. 검증된 변경을 원자적인 커밋으로 남긴다.

여기서 RED는 오류가 아니라 **아직 구현되지 않은 요구사항을 테스트가 제대로 잡았다는 증거**다.

### 3.3 결과를 이해한 뒤 PR로 보낸다

AI가 테스트를 통과시켰다고 바로 머지하지 않는다. 개발자가 먼저 다음을 확인한다.

- 변경된 동작을 직접 설명할 수 있는가?
- 요청하지 않은 기능이나 리팩터링이 섞이지 않았는가?
- 실패 케이스와 권한·데이터 경계가 테스트됐는가?
- 실제 실행한 검증 명령과 결과가 명확한가?

확인 후 `feature-merge`를 요청하면 품질 검증, PR 생성, AI 리뷰 처리, CI, 미해결 스레드 확인을 거쳐
`develop`에 머지한다. 세부 머지 조건은 [코드리뷰·커밋·PR 컨벤션](code-review.md)이 정본이다.

## 4. 기존 기능 수정과 버그 수정

기존 동작을 바꿀 때는 `feature-modify`를 사용한다. 핵심은 **바뀔 동작만 RED로 만들고 나머지 테스트는
계속 GREEN으로 유지하는 것**이다.

```text
feature-modify 절차로 주문 취소 응답에 취소 시각을 추가해줘.
기존 취소 가능 조건과 오류 응답은 바꾸지 마.
```

- 기능 확장처럼 범위가 커지면 먼저 `plan`으로 변경 의도를 고정한다.
- 명백한 버그라면 재현 테스트를 먼저 추가하고 `fix/*` 브랜치에서 수정한다.
- 수정 범위 밖에서 발견한 개선점은 현재 변경에 섞지 않고 별도 Issue나 작업으로 분리한다.

## 5. 긴급 수정과 릴리즈

### 운영 장애: `hotfix`

`hotfix`는 `main`에서 분기해 회귀 테스트로 장애를 재현하고, 수정 PR을 `main`에 머지한 뒤 패치 태그를
게시한다. 마지막에는 반드시 `develop` 역병합 PR을 만들어 두 브랜치가 갈라지지 않게 한다.

긴급하다는 이유로 테스트나 PR 게이트를 생략하지 않는다. 운영 DB·운영 인프라 조작은 AI에게 맡기지 않는다.

### 정식 배포: `release-check` → `release`

`release-check`가 품질·보안·DB 마이그레이션을 먼저 확인한다. 모두 통과한 뒤 `release`가 release 브랜치,
`main` PR, 버전 태그, `develop` 역병합, 배포 후 헬스 체크를 순서대로 수행한다.

## 6. “진행해”라고 하면 무엇이 일어나는가

의도 라우터는 현재 브랜치와 열린 PR 상태를 읽어 다음 절차를 안내한다. 예를 들어:

- 승인된 계획이 있고 구현 전이면 `feature-add`
- feature 브랜치에 커밋이 있고 PR이 없으면 `feature-merge`
- 열린 PR이 있고 base 브랜치가 보호된 repo면 `pr-review-gate`
- 열린 PR의 base 브랜치 보호가 없어 솔로 repo로 판정되면 `solo-merge`

라우터는 편의를 위한 안내 장치다. 최종 판단 기준은 현재 상태와 각 skill의 수용기준이며, 적용 중인
skill과 phase는 작업 업데이트에서 확인할 수 있어야 한다. `solo-merge`도 리뷰를 건너뛰는 절차가 아니다.
먼저 AI 리뷰 지적을 처리하고 모든 리뷰 스레드를 resolve해야 하며, 머지 직전 CI·스레드·mergeability를
다시 검증한다.

## 7. 막혔을 때 우회하지 않기

| 증상 | 의미 | 다음 행동 |
|---|---|---|
| `main/develop 직접 커밋 금지` | 보호 브랜치에서 작업 중 | `feature/*` 또는 `fix/*` 브랜치로 이동 |
| `신규 feature 브랜치는 승인된 plan 필요` | 기능 의도가 아직 고정되지 않음 | `plan`으로 spec 작성·승인. 정말 자명한 변경만 trivial로 명시 |
| `맨손 gh pr create/merge 금지` | 리뷰·CI 절차 누락 방지 | `feature-merge`, `pr-create`, `pr-review-gate` 사용 |
| 테스트 실패 | 구현 또는 테스트 환경이 계약을 충족하지 못함 | 실패 원인을 수정하고 같은 검증을 재실행 |
| CI는 성공했지만 머지가 안 됨 | 리뷰 스레드·승인·mergeability 등 다른 게이트 미충족 | PR 게이트 결과를 확인하고 미충족 항목 해결 |
| 훅이나 skill이 보이지 않음 | 플러그인·Git hook 배선 문제 가능 | [온보딩](onboarding.md)과 [트러블슈팅](troubleshooting.md) 확인 |

`--no-verify`, 보호 규칙 해제, 테스트 삭제로 통과시키는 것은 해결이 아니다. 차단 메시지별 원인과 복구법은
[트러블슈팅](troubleshooting.md)이 정본이다.

## 8. Claude Code와 Codex의 차이

두 도구의 UI는 다르지만 완료 조건은 같다.

- Claude Code는 slash skill과 역할별 agent가 화면에 명시적으로 보일 수 있다.
- Codex는 읽은 `SKILL.md` 절차를 현재 agent가 직접 수행해 별도 skill 호출이 보이지 않을 수 있다.
- 어느 도구든 같은 테스트 계약, PR 래퍼, 리뷰·CI 게이트를 통과해야 한다.
- 프로젝트 stack에 해당하는 `.claude/rules/*.md`도 작업 전에 함께 읽는다.

도구별 설치와 Codex 추가 설정은 [onboarding.md의 AI 도구 섹션](onboarding.md#d-claude-codecodex기타-ai-도구)을
따른다.

## 9. 작업 완료 체크리스트

- [ ] 요청한 범위만 변경했다.
- [ ] 정상·예외·경계 동작을 테스트했다.
- [ ] repo의 `AGENTS.md`에 정의된 전체 품질 명령이 통과했다.
- [ ] 변경 내용을 내가 설명할 수 있다.
- [ ] 시크릿·개인정보·운영 데이터가 코드, 로그, 프롬프트에 들어가지 않았다.
- [ ] PR의 AI 리뷰 지적을 반영하거나 근거를 답하고 모든 스레드를 resolve했다.
- [ ] required CI와 필요한 사람 승인이 통과했다.
- [ ] 릴리즈나 hotfix라면 태그, 역병합, 배포 후 헬스 체크까지 확인했다.

## 10. 더 자세히 볼 문서

| 궁금한 내용 | 정본 |
|---|---|
| 전체 구조와 강제 계층 | [intro.html](intro.html) |
| 프로젝트·개발자 최초 설치 | [onboarding.md](onboarding.md) |
| AI에게 일을 맡기고 검수하는 원칙 | [ai-collaboration.md](ai-collaboration.md) |
| 커밋·PR·리뷰 내용 기준 | [code-review.md](code-review.md) |
| 가드 차단과 복구 | [troubleshooting.md](troubleshooting.md) |
| team-harness 자체를 변경·배포 | [harness-maintenance.md](harness-maintenance.md) |
| 개별 절차의 최신 실행 계약 | [`plugins/harness-guard/skills/`](../plugins/harness-guard/skills/) |
