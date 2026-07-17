# AI 워크플로 표준화 스펙

## 1. 목표 & Why

AI가 코드 작성부터 commit·push·PR까지 수행해도 커밋 기록이 짧고 일관된 한국어 형식으로 남고,
반복 수정과 skill 자동 선택이 Claude Code·Codex에서 같은 의미로 작동하도록 하네스 계약을 보강한다.
**성공 기준: Node.js가 있는 로컬과 CI에서 부적합 커밋을 동일하게 거부하고, Node.js가 없는 non-Node
로컬 환경은 커밋을 막지 않되 필수 CI가 강제한다. `/loop`의 결정적 안전 장치는 실행 테스트로 검증되며,
16개 skill의 자동 선택 경계와 런타임별 모델/effort 매핑이 문서와 테스트에서 일치한다.**

## 2. Scope

- **In:** 커밋 메시지 형식·로컬/CI 강제, 신규 repo 배선과 repo-sync 드리프트 점검, `/loop` 안전성·테스트,
  16개 skill description의 implicit trigger 경계, 상태 기반 `route-intent`와 의미 기반 자동 선택의 역할 분리,
  Claude Code·Codex 모델/effort 문서, 관련 README·개발자 문서·버전·결정 기록.
- **Out (Non-goals):** LLM 키워드 분류기를 새로 만들기, 사용자 동의 없이 머지·릴리즈 권한 확대,
  기존 소비 repo 파일 자동 덮어쓰기, 모델 slug를 Codex agent에 고정, git commit 본문에 장문 템플릿 강제,
  `/loop`를 완전한 별도 실행 엔진으로 재작성.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (커밋 헤더):** WHEN 일반 커밋을 생성하면, the system SHALL Conventional Commits 1.0.0의
  `<type>[optional scope][!]: <description>` 문법과 호환되는 `<type>(<scope>): <한국어 요약>`을 검사한다.
  `feat|fix|refactor|perf|test`는 team-harness 추가 규칙으로 scope가 필수이고,
  `docs|style|chore|ci|build|revert`는 의미 있는 scope가 있을 때만 사용한다. 요약은 한글을 포함하고 50자 이하이며
  마침표로 끝나지 않는다.
- **AC-2 (필요한 본문만):** WHEN `feat|fix|refactor|perf` 커밋을 생성하면, the system SHALL 빈 줄 뒤
  `이유:` 한 줄을 요구하고 `영향:`·`검증:`은 실제 정보가 있을 때만 허용한다. 그 밖의 타입은 헤더만으로
  충분하며 본문을 강제하지 않는다. breaking change는 표준대로 `!` 또는 `BREAKING CHANGE:` footer 중
  하나로 표시할 수 있고 둘을 중복 강제하지 않는다.
- **AC-3 (동일 강제):** WHEN Node.js가 있는 환경에서 사람이나 AI가 로컬 commit을 만들면 THEN
  `commit-msg` 훅이 같은 정책으로 즉시 거부한다. WHEN Node.js가 없는 non-Node 환경이면 THEN 훅은 경고 후
  통과시키고, WHEN PR을 열면 THEN 필수 CI commitlint가 `.cjs` 정본을 명시적으로 로드해 같은 validator로
  모든 PR commit을 검사한다. 기본 ignore는 끄며, merge/revert처럼 Git이 생성한 정확한 표준 메시지만
  validator의 정밀 예외로 허용한다.
- **AC-4 (신규·기존 repo):** WHEN `new-repo.sh`가 실행되면 THEN validator·`commit-msg` 훅·commitlint
  config가 함께 설치되고 실행권한이 설정된다. 기존 repo에서 자산이 빠지거나 commitlint action이 `.cjs`
  정본을 명시하지 않으면 `repo-sync`가 드리프트로 보고한다.
- **AC-5 (`/loop` 종료 정확성):** WHEN 루프의 첫 수정 후 통과하면 THEN 반복 수는 1로 기록된다. 각 검증
  명령은 기본 timeout 안에서 종료하고 timeout은 non-zero로 판정한다. timeout 시 TERM을 무시하는 descendant도
  SIGKILL 단계에서 종료한 뒤 반환하며, max·stuck·통과 중 하나로만 종료한다.
- **AC-6 (`/loop` 변경 감지·체크포인트):** WHEN tracked·staged·untracked 파일이 추가·수정·삭제되면 THEN
  fingerprint가 실제 내용 변화를 감지한다. 사용자가 초기 dirty 포함을 승인한 경우에만 공백 포함 경로와
  untracked 파일도 체크포인트에 포함한다. 자연어 맥락으로 자동 선택된 implicit invocation은 명시적 commit
  요청이 없으면 no-commit으로 실행하며, 공용 skill에는 특정 AI 도구의 공동작성 trailer를 하드코딩하지 않는다.
- **AC-7 (자동 skill 선택):** WHEN 자연어 작업이 skill description의 명확한 사용 시점과 일치하면 THEN
  Claude Code와 Codex가 implicit invocation 후보로 식별할 수 있도록 핵심 trigger와 제외 경계를 description
  앞부분에 둔다. Git/PR의 “진행해”는 기존 `route-intent` 상태 판정이 담당하고, 일반 단어 substring만으로
  `/loop`·`hotfix`·`repo-sync`를 주입하지 않는다.
- **AC-8 (권한 불변):** WHILE skill이 자동 선택되더라도, the system SHALL 사용자 요청이 허용하지 않은
  commit·push·PR·merge·release·운영 변경 권한을 새로 만들지 않고 각 wrapper·승인·CI 게이트를 유지한다.
- **AC-9 (런타임별 티어링):** WHEN 모델/effort 정책을 읽으면 THEN 공통 작업 난이도와 함께 Claude Code는
  skill `effort` + Explore/Haiku·general-purpose/Sonnet·verifier/security/Opus 매핑으로, Codex는 현재 선택
  model 상속 + `model_reasoning_effort` low/medium/high로 설명한다. Claude 전용 `effort:`가 Codex에도 강제된다고
  표현하거나 Codex model slug를 하드코딩하지 않는다.
- **AC-10 (문서 정합):** WHEN README·개발자 가이드·intro·AI 협업·모델 문서를 읽으면 THEN 자동 선택,
  `/loop`, 커밋 형식, Claude/Codex 차이를 같은 용어로 설명하고 “수동 전용/Claude 자동 가능” 같은 낡은
  단일 런타임 표기를 남기지 않는다.

## 4. 제약 / 비기능

- commit 검사는 Node 기본 모듈만 사용하고 네트워크·프로젝트 패키지 설치 없이 1초 안에 끝나야 한다.
- `/loop`의 timeout helper와 상태 판정은 macOS·Linux의 bash/Git 환경에서 결정적으로 테스트 가능해야 한다.
- skill description은 초기 목록에서 잘려도 핵심 trigger가 남도록 짧고 앞부분에 사용 시점을 둔다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 공용 표준과 런타임별 매핑 분리, 좁은 validator/helper 추가, 관련 테스트·문서·버전 갱신.
- ⚠️ 먼저 물어봐: 기존 소비 repo를 자동 수정하거나 commit history를 재작성하는 마이그레이션.
- 🚫 절대 금지: branch protection·PR wrapper 완화, 임의 모델 slug 고정, 일반 키워드 substring 자동 라우팅,
  테스트 삭제·약화, 사용자 요청 없는 외부 상태 변경.

## 6. Open Questions

없음. “필요한 부분만”은 코드 의미를 바꾸는 `feat|fix|refactor|perf`에만 `이유:`를 요구하고,
나머지는 한국어 헤더만 허용하는 것으로 해석한다.

## 7. 기술 접근 (HOW)

- `scripts/check-commit-message.cjs`를 로컬 hook과 commitlint custom rule이 함께 쓰는 정책 코어로 만들고,
  root/template config와 `new-repo.sh`·`check-repo-sync.mjs`를 같은 자산 계약에 연결한다.
- `/loop`는 모델이 수행하는 workflow 구조를 유지하되, 검증 명령 timeout을 담당하는 작은 Node helper와
  tracked/staged/untracked 내용을 포함하는 worktree fingerprint, NUL-safe 또는 `git add -A -- .` 체크포인트,
  반복 시작 시 카운트 증가를 명시한다.
- 16개 `SKILL.md`의 `description`을 “언제 사용/언제 제외” 중심으로 정규화한다. 공식 implicit matching을
  공통 경로로 사용하고 `route-intent.mjs`는 현재 상태 기반 Git 단계 라우터로 유지한다.
- `docs/model-tiering.md`를 공통 난이도 → Claude Code 매핑 → Codex 매핑 순으로 재작성한다. 공식 근거는
  [Claude skills](https://code.claude.com/docs/en/skills),
  [Claude model configuration](https://code.claude.com/docs/en/model-config),
  [Codex skills](https://developers.openai.com/codex/codex-manual.md#build-skills)의 현재 계약을 사용한다.
- plugin/templates 동작 변경이므로 manifest와 README badge를 `0.57.0`으로 올리고 결정 기록을 남긴다.

### 테스트 전략

- AC-1~4: `tests/commit-message-test.sh`, `tests/new-repo-test.sh`, `tests/repo-sync-test.sh`
- AC-5~6: `tests/loop-skill-test.sh` + timeout helper 단위 실행
- AC-7~8: `tests/skill-trigger-contract-test.sh`, 기존 `tests/route-intent-test.sh` 잠금
- AC-9~10: `tests/codex-skill-mapping-test.sh`, `tests/enforce-subagent-model-test.sh`, 문서 sentinel 검사
- 전체: `.github/workflows/ci-gate.yml` quality job의 로컬 재현, `git diff --check`

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | 커밋 메시지 RED 계약과 validator·로컬/CI 배선 | AC-1~4 | `tests/commit-message-test.sh`, `scripts/check-commit-message.cjs`, `commitlint.config.cjs`, `templates/`, `new-repo.sh`, `check-repo-sync.mjs` | `bash tests/commit-message-test.sh && bash tests/new-repo-test.sh && bash tests/repo-sync-test.sh` | — | [P] |
| 2 | `/loop` RED 계약과 timeout·반복·fingerprint·checkpoint 교정 | AC-5~6 | `tests/loop-skill-test.sh`, `plugins/harness-guard/scripts/`, `skills/loop/SKILL.md`, Codex overlay | `bash tests/loop-skill-test.sh` | — | [P] |
| 3 | 16개 skill trigger description과 자동/상태 라우팅 경계 정규화 | AC-7~8 | `skills/*/SKILL.md`, `tests/skill-trigger-contract-test.sh`, `route-intent` 관련 문서 | `bash tests/skill-trigger-contract-test.sh && bash tests/route-intent-test.sh && bash tests/skill-discovery-test.sh` | — | [P] |
| 4 | Claude/Codex 티어링과 개발자 문서 정합화 | AC-9~10 | `docs/model-tiering.md`, `docs/ai-collaboration.md`, `docs/developer-workflow.md`, `docs/intro.html`, `README.md`, `AGENTS.md`, templates | 문서 sentinel + `bash tests/codex-skill-mapping-test.sh && bash tests/enforce-subagent-model-test.sh` | #2, #3 | |
| 5 | 결정·버전 갱신과 전체 회귀 검증 | AC-1~10 | `docs/decisions.md`, manifest, README, CI test wiring | CI quality 로컬 재현 + `git diff --check` | #1~4 | |
