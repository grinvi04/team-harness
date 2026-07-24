# codex-native-loader 스펙

## 1. 목표 & Why

Codex가 Team Harness monolith를 공식 marketplace·plugin·hook surface에서 source-native로 설치하고 실행하게 해,
설치 cache를 직접 고치는 `patch-codex-harness-guard.mjs` 의존을 제거한다. **성공 기준: 격리된 공식 loader
설치와 새 Codex 세션에서 plugin/skill 발견, `PreToolUse` 가드, `UserPromptSubmit` 라우팅이 확인되고 원본 repo와
기존 사용자 상태가 검증 전후 동일하다.**

제품 방향 판정은 **연결**이다. Codex의 plugin 발견·설치·hook lifecycle은 플랫폼에 위임하고 Team Harness는
기존 GitHub delivery 정책과 결과 계약만 연결·검증한다.

## 2. Scope

- **In:** 기존 `harness-guard` monolith의 source-native Codex manifest와 Codex 전용 command hook 연결;
  Codex가 원본 skill을 cache 변환 없이 해석할 수 있는 실행 계약; harness cache patch 제거; 최신 Codex의
  unified exec hook 경로 사용; read-only doctor; 격리 loader 설치와 임시 repo의 새 세션 실측·보고.
- **Out (Non-goals):** 네 split package의 `installable:true` 전환이나 marketplace 공개; Claude Code hook·skill
  동작 변경; 외부 `security-guidance` plugin patch 제거; custom agent runtime 구현; 소비 repo backlog 수정;
  GitHub 정책·앱 build·배포.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (공식 manifest):** WHEN Codex가 기존 marketplace의 `harness-guard`를 읽으면, the plugin SHALL
  source에 포함된 `.codex-plugin/plugin.json`에서 동일 name/version과 skill·Codex hook 경로를 발견한다.
- **AC-2 (Codex hook):** WHEN Codex가 plugin-bundled `PreToolUse`와 `UserPromptSubmit`을 실행하면, the plugin
  SHALL `PLUGIN_ROOT` 아래의 기존 guard/secret-egress/route-intent 계약을 command handler로 실행하며 Claude
  전용 `prompt` handler나 cache에서 생성한 파일을 요구하지 않는다.
- **AC-3 (가드 반증):** WHEN clean 임시 repo의 새 Codex 세션이 테스트 파일 삭제 형태의 금지 명령을
  시도하면, the system SHALL 명령을 차단하고 sentinel·HEAD·status를 보존한다.
- **AC-4 (라우팅):** WHEN 스펙이 있는 clean 임시 repo의 새 Codex 세션에 “진행해”를 제출하면, the system
  SHALL `feature-add` 단계와 적용 skill을 모델-visible context에 제공한다.
- **AC-5 (skill source-native):** WHEN fresh plugin cache를 검사하면, the system SHALL 16개 Codex-native skill
  wrapper를 발견하고 각 wrapper가 공용 skill 계약과 Codex 실행 경계를 cache rewrite·overlay 주입·custom agent
  설치 없이 연결한다.
- **AC-6 (patch 제거):** WHEN 표준 Codex 갱신·doctor 경로를 실행하면, the system SHALL harness plugin의
  marketplace version과 native manifest/hook 상태를 검사하되 `patch-codex-harness-guard.mjs`를 실행하거나
  pending patch를 건강 조건으로 요구하지 않는다.
- **AC-7 (unified exec):** WHILE 현재 지원 Codex가 unified exec의 `PreToolUse`를 제공하면, the launcher SHALL
  이를 강제로 비활성화하지 않고 AC-3을 동일하게 만족한다.
- **AC-8 (격리·복구):** WHEN loader/session pilot이 실행되면, the system SHALL 인증정보를 출력·커밋하지 않고
  장기 refresh token·API key를 격리 홈에 복사하지 않으며, 임시 install/session 자산을 정리하고 repo와 사전에
  기록한 사용자 Codex plugin/marketplace 상태를 byte-equivalent하게 복구한다. 복구 검증 실패는
  fail-closed로 보고한다.
- **AC-9 (판정 보고):** WHEN pilot이 끝나면, Markdown/JSON report SHALL Codex/Team Harness revision, loader
  설치·skill·hook 결과, 사용자 상태 불변 여부, 검증/추론/한계를 구분하고 split package 승격 여부를 별도로
  판정한다.
- **AC-10 (회귀):** WHEN 전체 quality gate를 실행하면, the system SHALL Claude 경로와 기존 governance
  테스트를 포함해 exit 0으로 완료한다.
- **AC-11 (provenance·fail-closed):** WHEN hardened launcher와 live pilot이 native hook을 검증하면,
  the system SHALL trusted checkout과 installed critical surface의 version·content·hook command를 exact하게
  대조하고, clean Git tree·검증한 Codex binary digest·실제 session transcript digest를 revision에 결합한다.
  fixture binary는 live 증거로 승격하지 않으며 malformed·불완전 PreToolUse payload는 차단한다.
- **AC-12 (live evidence trust anchor):** WHEN live pilot을 실행하면, the system SHALL repo에 승인된 Codex
  binary version·digest와 macOS Apple trust chain의 OpenAI Developer ID를 함께 검증하고, 검증한 realpath를
  사용자 홈 비식별 형태로 기록한다. guard는 서로 다른 두 session의 실제 router block을 구조화·비식별하고,
  routing은 정확한 agent-message event만 보존해 artifact digest를 재계산한다. pilot revision 이후 release
  candidate 변경은 pilot evidence와 changelog로 제한한다.
- **AC-13 (exact installed surface):** WHEN native plugin을 검증하면, the system SHALL hook event를
  `PreToolUse`·`UserPromptSubmit` exact inventory로 제한하고 wrapper가 참조하는 공용 skill을 포함한 전체 plugin
  file inventory·digest를 trusted checkout과 비교하며 installed/trusted root의 non-symlink inode·realpath가
  검사 전후 동일한지 확인한다.
- **AC-14 (binary trust continuity):** WHEN hardened launcher나 live pilot이 Codex를 실행하면, the system
  SHALL canonical binary의 승인 digest·OpenAI code signature·version을 첫 사용 전에 확인하고 모든 후속
  subprocess를 첫 instruction 전에 suspend해 PID의 동적 OpenAI requirement·CDHash를 static 검증 결과와
  대조한 뒤에만 resume한다. path·digest·device·inode·size identity도 실행 전후 검증한다. launcher의
  sync·native 검사와 최종 실행은 최초 검증 digest·CDHash에 결박하며 PATH shadow·live override·검증 뒤
  byte/inode 교체와 check→spawn 교체는 fail-closed한다.
- **AC-15 (source·session credential trust):** WHEN live pilot이 source plugin과 모델 session을 실행하면,
  the system SHALL operator가 명시한 GitHub repository·remote branch ref·exact revision을 독립 remote
  상태와 대조한 뒤에만 인증 환경을 준비한다. 임의 clean source나 remote/ref/SHA 불일치는 Codex 실행 전에
  거부한다. 격리 홈에는 현재 session에 필요한 access/id/account 값만 제공하고 refresh token·API key는
  제공하지 않는다. subprocess 환경은 실행에 필요한 비밀 없는 key allowlist만 상속하고 `HOME`·`CODEX_HOME`
  및 XDG config/data/state/cache/runtime root를 같은 격리 홈 아래로 고정한다. 검증된 Codex path·digest·CDHash만
  runner가 새로 주입하며 inherited credential·config alias는 전달하지 않는다. wget credential URL/header와
  high-signal credential 파일 및 활성 `CODEX_HOME/auth.json` upload는 실제 source option·stdin·positional
  source에 결합해 차단하고 `curl -o`·`wget -O` 같은 로컬 출력 경로는 source로 오인하지 않는다. 제3 live
  session은 loopback closed port를 대상으로 격리 auth 경로 차단을 증거화한다. `scp`·`rsync`는 option
  operand와 positional operand를 구분하고
  마지막 positional operand가 `host:path`·`user@host:path`·`user@[IPv6]:path`·remote URI일 때만 원격
  목적지로 판정해, 원격 source의 로컬 복원을 차단하지 않는다. macOS 전용 suspended-spawn 반례는
  main·develop의 `atomic-trust-macos` required CI check에서 실제로 실행한다.

## 4. 제약 / 비기능

- Codex 0.144.6의 설치된 CLI help와 2026-07-22 최신 공식 Codex manual을 구현 시점 계약으로 기록하고,
  버전 차이는 report의 한계로 남긴다.
- loader/session 실측은 OS 임시 디렉터리와 disposable Git repo만 작업 대상으로 사용한다.
- live pilot source는 명시적으로 승인된 GitHub remote ref의 exact revision만 허용한다. 인증은 session 범위
  값으로 축소하며 refresh token·API key는 source-controlled hook·검사 경로에 노출하지 않는다.
- plugin 동작과 소비자 설치 경로 변경이므로 Claude·Codex manifest와 README 배지를 MINOR 버전으로 함께 올린다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: repo-local marketplace fixture, 임시 plugin state, disposable repo, read-only 사용자 상태 snapshot,
  실패 후 원자 복구, monolith Codex manifest·hook·skill 호환 변경.
- ⚠️ 먼저 물어봐: 현재 인증된 사용자 Codex plugin/marketplace 상태를 일시적으로 바꾸는 실제 모델 session;
  split package 승격; Claude와 외부 plugin의 cache patch 제거.
- 🚫 절대 금지: 인증정보를 report/log/Git에 기록; public marketplace publish; 복구 검증 없는 사용자 상태 변경;
  guard·secret-egress·GitHub gate 완화; DriveTree 파일 수정.

## 6. Open Questions

없음. 사용자가 Codex 경로 우선 전환과 실제 모델 session을 위한 현재 사용자 Codex
marketplace/plugin 상태의 정확한 snapshot→임시 local source 설치→검증→복구를 승인했다.

## 7. 기술 접근 (HOW)

- 기존 monolith root에 Codex 공식 entry point와 Codex 전용 hooks JSON을 두고, hook command는 공식
  `PLUGIN_ROOT`를 통해 현재 guard·route-intent·secret-egress adapter를 호출한다.
- Codex manifest는 `codex/skills/*/SKILL.md`의 얇은 native wrapper를 읽는다. 각 wrapper는 해당 공용 skill
  계약을 참조하고 Codex 실행 차이만 설명해 Claude-facing `skills/`를 보존한다. patcher의 skill rewrite와
  `$HOME/.codex/agents` 설치는 제거하고 subagent 선택은 플랫폼에 위임한다.
- launcher는 marketplace version sync 뒤 native contract를 점검하고 외부 `security-guidance` 호환 단계만 유지한다.
  doctor는 native manifest/hook/skill을 read-only로 검사한다.
- launcher와 pilot은 공용 binary trust helper를 사용하고, launcher가 호출하는 sync·native 검사도 검증된
  절대경로·digest·CDHash를 전달받는다. macOS helper는 suspended PID의 dynamic codesign을 검증한 뒤 resume하고
  각 Codex subprocess 전후 pathname identity도 재확인한다. Ubuntu 전체 quality와 별개로 macOS runner가
  atomic replacement 반례를 실제 실행해 플랫폼 전용 신뢰 경계의 false-green을 막는다.
- loader pilot은 Codex CLI를 fake하지 않는 통합 경로와 빠른 fixture 단위 테스트를 분리한다. 실제 모델 session은
  operator-approved GitHub remote ref의 exact revision에서만 시작하고, refresh token·API key를 제거한 session
  credential로 disposable Git repo의 sentinel 불변과 hook-visible 결과만 검사한다.
- AC별 검증은 manifest/hook 계약 테스트(AC-1,2,5~7), disposable loader/session pilot(AC-3,4,8,9),
  전체 CI quality job(AC-10)으로 나눈다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | native manifest·hook·skill source 계약 RED→GREEN | AC-1,2,5 | `tests/codex-native-loader-test.sh`, `plugins/harness-guard/.codex-plugin/`, `plugins/harness-guard/codex/` | `bash tests/codex-native-loader-test.sh` | — | |
| 2 | harness cache patch 제거와 launcher/doctor 전환 | AC-6,7 | `tests/codex-hardened-launcher-test.sh`, `tests/harness-doctor-test.sh`, `scripts/codex-hardened.sh`, `scripts/harness-doctor.sh`, patcher·기존 테스트 | 해당 테스트 2개 + patch 참조 0건 검사 | #1 | |
| 3 | 격리 loader·새 session pilot과 report 계약 | AC-3,4,8,9,15 | `tests/codex-native-loader-pilot-test.sh`, `scripts/run-codex-native-loader-pilot.mjs`, `docs/pilots/` | fixture 테스트 + 승인된 실제 pilot | #1,2 | |
| 4 | 제품 경계·결정·버전·CI 정합 | AC-9,10 | `docs/product-{direction,boundaries}.md`, `docs/decisions.md`, `docs/harness-maintenance.md`, `README.md`, plugin manifest, `.github/workflows/ci-gate.yml` | CI `quality` job 로컬 재현 | #1~3 | |
