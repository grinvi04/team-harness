# Harness 설치·갱신·점검

[README로 돌아가기](../README.md). 이 문서는 해당 주제의 상세 정본이다.

## 🚀 빠른 시작

English-language onboarding is available in the [Quick Start](quick-start.md). Before adopting Team Harness,
check the [supported environments and validation levels](support.md).

### 설치 전 준비

- [지원 환경](support.md)의 macOS 또는 Linux에서 Bash·Git·Node.js20 이상을 준비한다.
- 사용할 도구 하나를 선택해 공식 [Codex CLI 설치·로그인](https://learn.chatgpt.com/docs/codex/cli) 또는
  [Claude Code 설치·로그인](https://code.claude.com/docs/en/setup)을 완료한다. 아래 명령은 **터미널**에서 실행한다.
  Codex Desktop 사용자도 설치·점검 명령에는 plugin 명령을 지원하는 Codex CLI가 필요하다.
- Codex 구성 점검에는 Python3.11 이상이 필요하다. GitHub PR·CI를 선택한 경우에만 `gh` 설치·인증도 준비한다.
- 플러그인은 각 사용자 머신에 설치한다. 저장소 파일·Git hook·원격 보호의 적용은 아래 저장소 연결 단계다.

### Claude Code 최초 설치

```bash
claude plugin marketplace add grinvi04/team-harness
claude plugin install harness-guard@team-harness --scope user
claude plugin list --json
```

목록에서 `harness-guard@team-harness`의 버전·enabled 상태를 확인한다. 이 안내의 대상은1.0.0이며 [발행 태그](https://github.com/grinvi04/team-harness/tree/v1.0.0)를 먼저 확인한다.
Claude marketplace는 기본 브랜치를 조회한다. 이후 갱신은 공식 [플러그인 관리](https://code.claude.com/docs/en/discover-plugins)를 따른다.
이미 등록·설치된 경우 현재 목록부터 확인하며, 로컬 개발 source를 임의로 교체하지 않는다.

### Codex 최초 설치·갱신

아래는 v1.0.0 태그에 고정한 설치다. 태그가 없으면 [전달 기록](specs/team-harness-redesign/delivery.md)을 확인하고 설치를 기다린다. **다른 태그·경로로 이미 등록돼 있으면
[Native Refresh Runbook](specs/codex-guard-compatibility.md#codex-native-refresh-runbook)의 기존 source 전환을 먼저 수행한다.**
`/path/to/release-source`는 `marketplace add`의 JSON 결과에 있는 `installedRoot`로 바꾼다.
검사기와 비교 원본도 해당 태그에서 가져오며, 이전 개발 checkout의 검사기를 사용하지 않는다.

```bash
codex plugin marketplace add grinvi04/team-harness --ref v1.0.0 --json
codex plugin add harness-guard@team-harness --json
codex plugin list --marketplace team-harness --json
node "/path/to/release-source/scripts/check-codex-native-plugin.mjs" --expected-version 1.0.0 --trusted-root "/path/to/release-source/plugins/harness-guard"
```

기존 로컬 개발 checkout을 전환하거나 외부 플러그인을 수정하지 않는다. 다음 갱신 때는 승인된 새 태그를 명시한다.
Codex의 managed `hooks=true` 설정은 [온보딩 D절](onboarding.md#d-claude-codecodex기타-ai-도구)의 별도 관리자 작업이다.
그 스크립트 경로는 위 `installedRoot`의 원본 루트로 바꿀 수 있다.
기존 관리 정책이 있으면 먼저 확인하고 보존한다. plugin 설치만으로 이 설정이 생기지는 않는다.
설치 목록·파일 계약 검사와 실제 hook 발화는 다른 검증이다. 도구를 새로 시작하고 새 대화에서 skill을 로딩한다.

### 저장소 연결과 첫 업무

자산 적용·점검 스크립트에 필요한 `/path/to/team-harness`는 원본 루트 경로다. Codex는 위 `installedRoot`를 재사용한다.
원본이 없다면 **제품 디렉터리 밖의 부모 디렉터리**에서 아래로 받는다. 기존 `team-harness` 디렉터리가 있으면 재복제하지 않는다.

```bash
git clone --branch v1.0.0 https://github.com/grinvi04/team-harness.git team-harness
```

이때 `/path/to/team-harness`를 복제한 디렉터리의 절대 경로로 바꾼다. 플러그인만 사용할 때는 별도 복제가 필요 없다.

**제품 저장소 루트**에서 시작한다. Team Harness 자체 저장소를 제품 업무의 작업 디렉터리로 사용하지 않는다.
기존 저장소는 [선택 적용](guides/existing-repository.md), 새 프로젝트는 [온보딩의 범위 선택](onboarding.md#먼저-사용할-범위-선택)을 따른다.
이미 구성된 프로젝트의 팀원은 기존 `core.hooksPath`와 `.githooks` 내용을 확인하고 [팀원 온보딩](onboarding.md#b-신규-팀원-온보딩-각자-1회)을 적용한다.
기존 hook을 덮어쓰지 않는다. `new-repo.sh`는 신규 자산 일괄 연결용이며 기존 제품에는 선택 적용을 우선한다.

혼자는 [첫 확인 요청 → 실제 업무 요청](guides/solo-development.md#처음-연결할-때),
작은 팀은 [각자 첫 확인 → 공유 업무·담당자 요청](guides/team-development.md#처음-함께-사용할-때)을 사용한다.
단계별 완료 기준과 요청 예시는 이 두 가이드에서 관리한다. PR은 기존 [리뷰·승인 계약](code-review.md)을 유지한다.

### 현재 상태 점검

아래 `/path/to/team-harness`는 검사 스크립트를 가진 원본 루트다. Codex 설치 결과의 `installedRoot`도 사용할 수 있다.
처음에는 [구성별 점검](guides/existing-repository.md)에서 실제로 선택한 `tech`·`github`·`codex`만 검사한다.
자산을 아직 채택하지 않았다면 `tech` 기록도 없으며, 이를 적용 완료로 처리하지 않는다.

```bash
PYTHON_BIN=python3.11 bash "/path/to/team-harness/scripts/harness-doctor.sh" --repo . --components codex --expected-version 1.0.0
```

구성 실패는 해당 설치·설정부터 해결한다. 구성 PASS도 새 세션의 실제 hook 집행을 증명하지 않는다.
`--components` 없는 전체 점검은 개인용 repo-sync·Codex·main/develop GitHub 보호를 모두 선택했을 때 사용한다.

### 선택적 실제 hook 검증

launcher는 공식 설치 상태·native loader를 점검하며 외부 `security-guidance` cache를 자동 수정하지 않는다.
이전 cache 보완은 별도 승인 후 `patch-codex-security-guidance.mjs --apply`로만 실행한다.
[현재 삭제 보류 근거](specs/global-cleanup-upgrade.md#security-guidance-삭제-보류-근거)는 실제 상류 호환·patched 소비 경계의 미확인을 구분한다.
`--probe`는 별도 격리 fixture·모델 실행 검증이다.

실제 새 Codex 세션에서 합성 위험 명령과 가짜 시크릿 전송의 `PreToolUse` 차단을 확인하려면
**설치·cache 갱신과 모델 호출·격리 실행이 승인된 경우에만** 제품 저장소 루트에서 아래를 실행한다.
launcher는 지정한 source 기준으로 설치 cache를 동기화한 뒤 확인하고, doctor는 Codex 구성과 실제 차단을 점검한다.

```bash
HARNESS_SOURCE="/path/to/team-harness"
bash "$HARNESS_SOURCE"/scripts/codex-hardened.sh --version
PYTHON_BIN=python3.11 bash "$HARNESS_SOURCE"/scripts/harness-doctor.sh --repo . --probe --components codex --expected-version 1.0.0
```

`HARNESS_SOURCE`는 위 발행 태그의 원본 루트로 바꾼다. probe는 throwaway
디렉터리와 loopback 폐쇄 포트만 사용하고, 검토된 hook을 해당 invocation에서만 실행하도록 hook trust를
일회성 우회한다(approval·sandbox는 유지). 인증된 Codex 세션의 모델 토큰을 소비하므로 CI에서는 실행하지 않는다.
