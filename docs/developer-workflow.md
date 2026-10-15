# 개발자 워크플로 가이드

기술 기준은 [표준 적용 범위](standards-scope.md)를 먼저 확인하고 해당 프로젝트의 채택 조건으로 읽는다.

> 이 문서는 team-harness를 **사용해 제품 코드를 개발하는 사람**을 위한 길잡이다.
> 처음 설치한다면 [onboarding.md](onboarding.md), 전체 구조를 먼저 보고 싶다면
> [아키텍처 안내](harness-architecture.md)를 읽는다.

## 1. 제품 저장소에서 시작하기

실제 첫 확인·업무 시작 요청과 단계별 완료 기준은 [제품 개발 가이드](guides/solo-development.md)가 정본이다.
혼자는 그 문서의 [첫 연결과 업무 요청](guides/solo-development.md#처음-연결할-때), 작은 팀은
[팀 사용 가이드](guides/team-development.md#처음-함께-사용할-때)를 따른다. 이 문서는 업무별 계약을 찾는 색인이다.
일반 설계·TDD·디버깅은 선택한 방법론 하나로 수행하고 이미 유효한 계획·검사를 재사용한다.

로컬 전용 제품은 제품의 검사·진행 기록으로 마치며 원격 생성·공개·PR을 강요하지 않는다.
GitHub를 사용하면 제품이 채택한 브랜치 흐름과 기존 리뷰·CI·보호를 유지한다.
PR base는 명시한 `--base` 또는 제품 `.harness-policy.json`의 `branchFlow`로 정한다.
`main`은 작업 브랜치→main, `git-flow`는 작업 브랜치→develop이다. develop 존재만으로 추정하지 않으며,
선언·명시 대상이 충돌하거나 둘 다 없으면 push 전에 중단한다. 실행 계약은
[`pr-create`](../plugins/harness-guard/skills/pr-create/SKILL.md)가 정본이다.

이 **team-harness 저장소 자체**는 [Git Flow 순서 검사](code-review.md#git-flow-순서-검사--team-harness-자체-전달)를 유지한다.
다른 제품의 main 중심 흐름과 혼동하지 않는다. AI가 작성한 결과를 설명하고 검수할 책임은 개발자에게 있다.
책임 원칙은 [AI 협업 가이드](ai-collaboration.md)를 따른다.

## 2. 지금 하려는 일 찾기

| 하려는 일 | 시작 위치 | 사용할 절차 | 완료 결과 |
|---|---|---|---|
| 새 기능 개발 | 제품이 채택한 base 또는 기존 작업 브랜치 | 승인된 계획 재사용 → `feature-add` 계약 | 테스트된 기능 커밋이 `feature/*`에 생성됨 |
| 기존 기능 확장 | 제품이 채택한 base 또는 기존 작업 브랜치 | 필요한 계획만 보완 → `feature-modify` 계약 | 변경 동작은 GREEN, 기존 동작도 유지됨 |
| 버그 수정 | 제품이 채택한 base | `feature-modify` | 재현 테스트와 수정이 `fix/*`에 생성됨 |
| 원인 불명 실패 진단 | 현재 브랜치 | `systematic-debugging` | 재현·가설 판별로 근본 원인 또는 미확정 증거가 보고됨 |
| 완료 주장 재검증 | 어느 브랜치든 가능 | `verification-before-completion` | 현재 worktree·HEAD 기준 `VERIFIED / NOT VERIFIED` 판정 |
| PR 생성 | 작업 브랜치 | `pr-create` | 명시 base 또는 제품 `branchFlow`를 검증한 PR 생성; 머지는 별도 |
| Git Flow 기능·수정 머지 | `feature/*` 또는 `fix/*` | `feature-merge` | 리뷰·CI 게이트 후 `develop` 반영 |
| 반복되는 CI·lint 수정 | 작업 브랜치 | `loop` | 지정 명령이 exit 0이 될 때까지 반복. 맥락 자동 선택이면 명시적 요청 없이 commit하지 않음 |
| 프론트엔드 품질 확인 | 작업 브랜치 | `qa` | 디자인 토큰과 WCAG 2.2 점검 결과 |
| Git Flow 운영 긴급 수정 | `main` 기준 | `hotfix` | `main` 태그 배포 후 `develop` 역병합 |
| Git Flow 정식 릴리즈 | `develop` | `release-check` → `release` | `main` 태그 배포 후 `develop` 역병합 |
| 하네스 상태 확인 | 어느 브랜치든 가능 | `harness-doctor.sh` | 로컬 설정·플러그인·repo·브랜치 보호 진단 |

<a id="6-native-선택과-명시-호출"></a>

업무는 자연어로 요청할 수 있다. native 선택·명시 호출과 같은 방법론을 중복하지 않는 기준은
[역할 분담](guides/solo-development.md#자연어-요청과-역할-분담)을 따른다. 선택이 맞지 않으면 Codex는
`$plan`, Claude는 `/harness-guard:plan`처럼 명시한다. skill 선택은 실행 권한을 추가하지 않는다.
과거 라우터 범위와 당시 회귀는 [역사 스펙](specs/workflow-routing-scope.md)에 보존한다.

## 3. 업무별 실행 계약과 완료 경계

- 기능 개발의 요청·시험·커밋·PR 예시는 [기능 개발 상세](guides/feature-development.md)를 따른다.
- 기존 기능 변경은 [`feature-modify`](../plugins/harness-guard/skills/feature-modify/SKILL.md)에 변경·유지 검사를 연결한다.
  원인 불명 실패는 [`systematic-debugging`](../plugins/harness-guard/skills/systematic-debugging/SKILL.md)으로
  기대·실제값과 재현 증거를 고정한다. 진단만 요청했다면 수정하지 않는다.
- [`verification-before-completion`](../plugins/harness-guard/skills/verification-before-completion/SKILL.md)은
  현재 worktree·HEAD와 관련 환경·범위에 유효한 증거로 판정한다. 필수 실패·미실행은 `NOT VERIFIED`이며
  검증 자체가 수정·머지 권한을 만들지 않는다.
- PR·리뷰·머지는 [코드 리뷰 계약](code-review.md)을 따른다. main 중심 제품은 해당 제품의 머지 절차를,
  Git Flow 제품은 `feature-merge`·`release-check`·`release`·`hotfix`의 적용 범위를 확인한다.
  구현·PR 생성·병합·태그·설치·배포 완료를 각각 구분한다.
- 여러 단계의 인계·재개에는 [개발 조정](guides/solo-development.md)의 `ao-coordinate`를 선택한다.
  단순 수정은 직접 처리하며 필수 독립 검증은 구현자와 다른 인스턴스가 수행한다.

## 4. 막혔을 때 우회하지 않기

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

## 5. Claude Code와 Codex의 차이

두 도구의 UI는 다르지만 완료 조건은 같다.

- Claude Code는 slash skill과 역할별 agent가 화면에 명시적으로 보일 수 있다.
- Codex는 읽은 `SKILL.md` 절차를 현재 agent가 직접 수행해 별도 skill 호출이 보이지 않을 수 있다.
- Claude의 skill `effort`와 역할별 Haiku/Sonnet/Opus 매핑은 Claude 런타임 계약이다. Codex는 사용자에게
  승인된 native 역할의 모델·effort를 따른다. 명확한 저위험 구현에는 적합한 worker를 사용할 수 있다.
  예를 들어 승인된 Luna/max 구현 역할과 Luna/high 탐색 역할은 다른 배정이다. 현재 지원·상속과 실제
  실행값을 확인하며 설정을 임의 변경하지 않는다. 정본은 [모델 티어링](model-tiering.md)이다.
- 어느 도구든 같은 테스트 계약, PR 래퍼, 리뷰·CI 게이트를 통과해야 한다.
- 프로젝트 stack에 해당하는 `.claude/rules/*.md`도 작업 전에 함께 읽는다.

도구별 설치와 Codex 추가 설정은 [onboarding.md의 AI 도구 섹션](onboarding.md#d-claude-codecodex기타-ai-도구)을
따른다.

## 6. 작업 완료 체크리스트

- [ ] 요청한 범위만 변경했다.
- [ ] 정상·예외·경계 동작을 테스트했다.
- [ ] repo의 `AGENTS.md`에 정의된 전체 품질 명령이 통과했다.
- [ ] 변경 내용을 내가 설명할 수 있다.
- [ ] 관련 로드맵·스펙 체크리스트·진행·사용 문서를 현재 변경·검사·미해결 항목과 대조하고 갱신했다.
- [ ] 완료·미완료·차단·다음 행동을 맞췄고, PR 또는 로컬 인계에 갱신 경로·근거(영향 없으면 이유)를 연결했다.
- [ ] 연결 문서의 미체크·대기 표시를 대조했다. 실제 후속 작업과 재사용 체크리스트를 구분하고, 병합·릴리즈 후 확인 담당과 원본 링크를 남겼다([단계별 확인](ai-collaboration.md#단계가-바뀔-때-확인할-문서)).
- [ ] 시크릿·개인정보·운영 데이터가 코드, 로그, 프롬프트에 들어가지 않았다.
- [ ] PR의 AI 리뷰 지적을 반영하거나 근거를 답하고 모든 스레드를 resolve했다.
- [ ] required CI와 필요한 사람 승인이 통과했다.
- [ ] 릴리즈나 hotfix라면 태그, 역병합, 배포 후 헬스 체크까지 확인했다.

로컬 전용 개발은 PR·원격 CI·릴리즈 항목의 비적용 사유를 남긴다. 적용하지 않은 단계를 통과나 완료로 표시하지 않는다.

진행 상태가 있는 변경은 기존 스펙이나 PR 본문에 [문서 검사 선언](ai-collaboration.md#선언한-문서의-기계적-검사)을
연결하고 같은 checker를 로컬·PR CI에서 실행한다. 누락 대상과 근거 의미는 리뷰에서 별도로 확인한다.

## 7. 더 자세히 볼 문서

| 궁금한 내용 | 정본 |
|---|---|
| 전체 구조와 강제 계층 | [아키텍처 안내](harness-architecture.md) |
| 프로젝트·개발자 최초 설치 | [onboarding.md](onboarding.md) |
| AI에게 일을 맡기고 검수하는 원칙 | [ai-collaboration.md](ai-collaboration.md) |
| 커밋·PR·리뷰 내용 기준 | [code-review.md](code-review.md) |
| 가드 차단과 복구 | [troubleshooting.md](troubleshooting.md) |
| team-harness 자체를 변경·배포 | [harness-maintenance.md](harness-maintenance.md) |
| 개별 절차의 최신 실행 계약 | [`plugins/harness-guard/skills/`](../plugins/harness-guard/skills/) |
