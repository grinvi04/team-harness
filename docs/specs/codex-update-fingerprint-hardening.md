# Codex 갱신·fingerprint hardening 스펙

## 1. 목표 & Why

Codex 플러그인 갱신 뒤 필요한 동기화·호환 패치·실세션 검증을 한 경로로 안내하고, `/loop`의
worktree fingerprint가 큰 untracked 파일을 파일 크기만큼 메모리에 올리지 않도록 한다.
**성공 기준: 사용자 문서가 단일 갱신 명령과 doctor probe를 공통으로 안내하고, fingerprint가 고정 크기
청크로 파일 내용을 동일하게 해시하며 `/loop` timeout 안에서만 실행된다.**

## 2. Scope

- **In:** README·온보딩·하네스 유지보수 문서의 Codex 갱신 절차 통일, Intro 현재 버전 표시, untracked
  일반 파일의 스트리밍 fingerprint, 전용 회귀 계약, 결정 기록과 플러그인 버전 갱신.
- **Out (Non-goals):** Claude Code 갱신 명령 변경, Codex CLI 자체 업데이트, fingerprint 형식 변경 보장,
  파일 크기 제한이나 untracked 파일 제외 정책 추가.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (갱신):** WHEN Codex 사용자가 marketplace/plugin 최초 설치 뒤 또는 새 릴리스로 갱신할 때, 문서는
  `codex-hardened.sh --version` 한 명령이 플러그인 동기화와 호환 패치를 수행한다고 안내해야 한다.
- **AC-2 (검증):** WHEN 갱신이 끝났을 때, 문서는 `harness-doctor.sh --repo . --probe`로 실제 새 세션의
  guard 동작까지 검증하도록 안내해야 한다.
- **AC-3 (스트리밍):** WHEN fingerprint가 untracked 일반 파일을 읽을 때, 파일 전체 크기의 Buffer 대신
  고정 크기 청크를 반복해서 SHA-256에 반영해야 한다.
- **AC-4 (동작 보존):** WHEN tracked·staged·untracked·symlink·FIFO fixture를 fingerprint할 때, 기존 변화
  감지와 no-follow·race 검증 계약을 모두 유지해야 한다.
- **AC-5 (경계):** WHEN 빈 파일 또는 청크 경계보다 큰 파일을 fingerprint할 때, 정상 종료하고 내용 변경에
  따라 fingerprint가 달라져야 한다.
- **AC-6 (가용성):** WHEN fingerprint가 대용량 또는 검사 중 변경되는 untracked 파일을 만날 때, `/loop`는
  사용자 timeout 안에서 중단하고 초기 파일 크기·내용 metadata가 달라지면 fingerprint 생성을 거부해야 한다.
- **AC-7 (명령 경계):** WHEN plugin 경로에 공백·`$` 등 shell 특수문자가 있을 때, fingerprint timeout 실행은
  경로를 shell에서 다시 해석하지 않아야 하며 실패·timeout은 명시적인 Phase 3 실패 사유로 보고해야 한다.

## 4. 제약 / 비기능

- 파일 읽기용 메모리는 파일 크기가 아니라 고정 청크 크기에 비례해야 한다.
- untracked 경로의 repo 내부 확인, symlink no-follow, 열기 전·후 inode·크기·mtime·ctime 검증을 약화하지 않는다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: 기존 fingerprint helper 내부의 읽기 방식 교체와 전용 테스트 확장.
- ⚠️ 먼저 물어봐: fingerprint 입력 범위·해시 알고리즘·출력 형식 변경.
- 🚫 절대 금지: symlink 역참조, 특수 파일 내용 읽기, 테스트 skip, guard 완화.

## 6. Open Questions

없음. 사용자가 두 개선의 동시 진행을 승인했다.

## 7. 기술 접근 (HOW)

- `worktree-fingerprint.mjs`에서 `readFileSync(fd)`를 제거하고 재사용 가능한 고정 크기 Buffer와
  초기 크기만큼의 `readSync` 반복으로 내용을 순서대로 `hash.update`한다.
- 반복 전·후 fingerprint는 `run-with-timeout.mjs --argv`로 shell 재해석 없이 실행하고 실패·timeout이면
  명시적인 fingerprint 오류 상태로 stuck 판정을 중단한다.
- `loop-skill-test.sh`에 스트리밍·빈 파일·다중 청크·대용량 timeout·특수문자 경로와 size·mtime·ctime
  독립 변경 회귀를 추가한다.
- README, `docs/onboarding.md`, `docs/harness-maintenance.md`가 같은 Codex 갱신·검증 명령을 가리키고
  `docs/intro.html`의 현재 버전 표시를 manifest와 맞춘다.
- plugin 동작 변경이므로 MINOR 버전을 올리고 `docs/decisions.md`에 이유와 검증 범위를 남긴다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | 스트리밍·경계 RED 계약 추가 | AC-3~5 | `tests/loop-skill-test.sh` | `bash tests/loop-skill-test.sh`가 기존 구현에서 RED | — | |
| 2 | 청크 기반 fingerprint 구현 | AC-3~5 | `plugins/harness-guard/scripts/worktree-fingerprint.mjs` | `bash tests/loop-skill-test.sh` | #1 | |
| 3 | Codex 갱신·검증 문서 통일 | AC-1~2 | `README.md`, `docs/onboarding.md`, `docs/harness-maintenance.md`, `docs/intro.html` | 문서 계약 grep + 링크 검사 | — | [P] |
| 4 | 버전·결정 기록과 전체 품질 검증 | AC-1~5 | `plugin.json`, `README.md`, `docs/decisions.md` | CI quality 로컬 재현 | #2,#3 | |
| 5 | 릴리즈 보안검토에서 발견한 fingerprint 시간 경계 보강 | AC-6 | `loop/SKILL.md`, `worktree-fingerprint.mjs`, `tests/loop-skill-test.sh` | 대용량 timeout·동시 크기 변경 RED→GREEN | #2 | |
| 6 | 재검증에서 발견한 shell 재해석·종료상태·metadata 테스트 갭 보강 | AC-7 | `run-with-timeout.mjs`, `loop/SKILL.md`, `tests/loop-skill-test.sh` | 특수문자 경로·명시 실패 분기·독립 metadata 변경 RED→GREEN | #5 | |
