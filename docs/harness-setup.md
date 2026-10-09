# Harness 설치·갱신·점검

[README로 돌아가기](../README.md). 이 문서는 해당 주제의 상세 정본이다.

## 🚀 빠른 시작

English-language onboarding is available in the [Quick Start](quick-start.md). Before adopting Team Harness,
check the [supported environments and validation levels](support.md).

### 팀원 온보딩 (각자 1회, ~3분)

```bash
git clone <프로젝트-repo>             # .claude/ 포함 — 커맨드·권한 컨벤션 자동 적용
cd <프로젝트-repo>
git config core.hooksPath .githooks   # git 네이티브 가드 활성화
claude                                # 첫 실행 시 marketplace/plugin 신뢰 확인 → 설치
```

개인 설정은 `.claude/settings.local.json`에만 (gitignore됨).

### 신규 프로젝트 셋업 (리드 1회)

```bash
cd <새 repo 루트>
bash /path/to/team-harness/scripts/new-repo.sh
```

스크립트가 자동으로 처리: 템플릿 파일 복사 · `core.hooksPath` 설정 · main·develop branch protection.
이후 수동 3가지: **ci-gate.yml 스택 커스터마이징** · **AGENTS.md 작성** · **스택별 검사 연결**.
AI 리뷰는 PR마다 `/code-review` 스킬(구독 포함, API 과금 없음)이 수행 — 외부 봇·시크릿 불필요.
전체 절차: [`docs/onboarding.md`](onboarding.md)

### Claude Code 로컬 테스트 (플랜 불필요)

```
/plugin marketplace add /path/to/team-harness
/plugin install harness-guard@team-harness
```

main 브랜치에서 `git commit` 시도 → ⛔ 차단되면 정상.

### Codex 플러그인 갱신

Codex 설치·갱신은 [Native Refresh Runbook](specs/codex-guard-compatibility.md#codex-native-refresh-runbook)의 공식 CLI 경로를 따른다. v0.70.0 태그 발행 후 아래 명령으로 해당 버전에 고정해 설치한다. **다른 태그·경로로 이미 등록돼 있으면 runbook의 기존 source 전환을 먼저 수행한다.** 아래 `/path/to/release-source`는 `marketplace add`가 반환한 `installedRoot`다. 검사기와 비교 원본도 해당 태그에서 가져오며, 보존한 이전 개발 checkout의 검사기를 사용하지 않는다.

```bash
codex plugin marketplace add grinvi04/team-harness --ref v0.70.0 --json
codex plugin add harness-guard@team-harness --json
node /path/to/release-source/scripts/check-codex-native-plugin.mjs --expected-version 0.70.0 --trusted-root /path/to/release-source/plugins/harness-guard
```

기존 로컬 개발 checkout을 전환하거나 외부 플러그인을 수정하지 않는다. 다음 갱신 때는 승인된 새 태그를 명시한다.
설치 목록·파일 계약 검사와 실제 hook 발화는 다른 검증이며, 새 작업에서 갱신한 skill을 로딩한다.

launcher는 공식 설치 상태·native loader를 점검하며 외부 `security-guidance` cache를 자동 수정하지 않는다.
이전 cache 보완은 별도 승인 후 `patch-codex-security-guidance.mjs --apply`로만 실행한다.
`--probe`는 별도 격리 fixture·모델 실행 검증이다.

```bash
bash /path/to/team-harness/scripts/codex-hardened.sh --version
bash /path/to/team-harness/scripts/harness-doctor.sh --repo . --probe
```

### 현재 상태 종합 점검

```bash
bash /path/to/team-harness/scripts/harness-doctor.sh --repo .
```

기본 실행은 모델을 호출하지 않고 managed requirements, Codex·harness-guard 버전, native plugin 상태, `/repo-sync`,
main/develop branch protection을 읽기 전용으로 확인한다. 실제 새 Codex 세션에서 파괴 명령과 가짜 시크릿
전송이 `PreToolUse`에 차단되는지까지 확인하려면 명시적으로 `--probe`를 추가한다. probe는 throwaway
디렉터리와 loopback 폐쇄 포트만 사용하고, 검토된 hook을 해당 invocation에서만 실행하도록 hook trust를
일회성 우회한다(approval·sandbox는 유지). 인증된 Codex 세션의 모델 토큰을 소비하므로 CI에서는 실행하지 않는다.
