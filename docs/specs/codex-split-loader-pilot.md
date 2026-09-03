# codex-split-loader-pilot 스펙

## 1. 목표 & Why

staged split package를 Codex 공식 marketplace loader로 격리 설치하고 역순 제거해, loader가 실제 package
경계와 rollback을 보존하는지 반복 가능한 증거로 남긴다. 제품 방향 판정은 **연결**이다. Codex가 설치·제거와
cache lifecycle을 소유하고 Team Harness는 exact revision·artifact digest·사용자 상태 불변 결과만 검증한다.
**성공 기준: `v0.62.0` source에서 생성한 repository-only, agent-governed, workflow-assisted 구성을 공식 Codex
CLI로 설치·제거하고, 각 installed cache가 생성 artifact와 byte-equivalent이며 검증 전후 사용자 plugin 상태가
동일하다는 live Markdown/JSON 보고서를 만든다.**

## 2. Scope

- **In:** exact Git revision의 staged package build; 임시 local marketplace; 격리 HOME·CODEX_HOME의 공식
  `plugin marketplace add/remove`와 `plugin add/remove`; 세 Codex profile 구성; 설치 cache의 manifest·tree
  digest·version 검증; 역의존 순서 rollback; 실제 사용자 marketplace/plugin 상태의 read-only 전후 비교;
  실패 시 best-effort cleanup 뒤 fail-closed; fixture 계약 테스트; live 보고서와 제품 방향 기록.
- **Out (Non-goals):** split package `installable:true`; 공개 marketplace 등록; monolith 제거; Claude loader
  검증; 실제 모델 session·hook·skill 실행; Codex가 제공하지 않는 plugin dependency resolver나 환경 binding 구현;
  사용자 plugin·marketplace·인증 상태 변경.

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (exact source):** WHEN runner에 immutable Git commit이 주어지면, the system SHALL clean source의
  `HEAD`가 그 commit과 정확히 같을 때만 Git 제어 환경변수를 제거한 private checkout을 만들고 그 exact
  checkout의 builder·trust data로 네 package를 생성해 모든 artifact의 `sourcePluginCommit`을 검증한다. 다른
  HEAD나 일반 dirty source는 실행 전에 거부하고, `skip-worktree`로 숨긴 live 파일도 실행 입력으로 사용하지 않는다.
- **AC-2 (공식 loader):** WHEN 각 Codex profile을 검증하면, the system SHALL local marketplace를 공식
  `codex plugin marketplace add`로 등록하고 profile 구성 package를 core→adapter→workflow 순서로 설치한다.
- **AC-3 (설치 무결성):** WHEN plugin add가 성공하면, the system SHALL CLI가 반환한 non-symlink installed
  cache의 plugin name·version·전체 tree digest를 생성 artifact와 대조하고 path escape·누락·불일치를 거부한다.
- **AC-4 (profile 경계):** WHEN repository-only, agent-governed, workflow-assisted profile을 각각 실행하면,
  the system SHALL 정확히 `core`, `core+codex-adapter`, `core+codex-adapter+workflow`만 활성 상태로 관찰한다.
- **AC-5 (rollback):** WHEN profile 검증이 성공하거나 중간 단계가 실패하면, the system SHALL 설치 package를
  역의존 순서로 제거하고 marketplace를 제거한 뒤 격리 plugin 목록이 빈 상태임을 확인한다. rollback 실패는
  원래 실패보다 우선하지 않되 최종 판정을 FAIL로 만든다.
- **AC-6 (사용자 상태 불변):** WHEN 전체 pilot이 끝나면, the system SHALL 실제 사용자 marketplace/plugin
  상태의 전후 canonical digest가 동일하고 격리 HOME이 삭제됐음을 검증한다.
- **AC-7 (fail-closed):** IF Codex 명령이 nonzero, malformed JSON, 잘못된 plugin id/version/path를 반환하거나
  artifact/cache가 변조되면, the system SHALL PASS 보고서를 만들지 않고 비밀·개인 절대경로를 출력하지 않은 채
  nonzero로 종료한다.
- **AC-8 (증거 보고):** WHEN live pilot이 통과하면, Markdown/JSON report SHALL Codex version·binary digest,
  Team Harness revision·tree, package version·digest, profile별 install/rollback 결과, 사용자 상태 불변, 검증된
  사실·추론·한계를 구분해 기록한다. 두 report 경로는 source와 사용자 `CODEX_HOME` 밖의 기존 디렉터리에 있는
  새 non-symlink 파일이어야 하며, runner는 parent의 canonical path·device·inode를 게시 전후 재검증하고 기존
  파일을 덮어쓰지 않은 채 identity가 고정된 완성 bytes만 배타적으로 게시한다. 두 번째 게시 실패나 게시 후
  상태 snapshot 예외 시 게시한 pair를 identity 확인 후 회수하고, source·사용자 상태를 다시 검증한다.
- **AC-9 (비승격):** WHILE 공식 loader에 dependency/runtime binding 선언 surface가 없고 실제 hook session을
  검증하지 않았으면, the system SHALL split package `installable:false`, monolith alias, marketplace 공개 보류를
  유지한다.
- **AC-10 (회귀):** WHEN quality gate를 실행하면, the system SHALL 신규 fixture 테스트와 기존 package·profile·
  monolith loader 테스트를 포함해 exit 0으로 완료한다.

## 4. 제약 / 비기능

- 실측 기준 runtime은 설치된 `codex-cli 0.144.6`; 결과는 해당 버전·macOS 한 표본으로 제한한다.
- 외부 입력인 revision, CLI JSON, installed path, report path는 신뢰하지 않고 canonical path와 exact identity를
  검증한다.
- 격리 subprocess에는 loader에 필요한 최소 환경만 전달하고 access/refresh token·API key를 전달하지 않는다.
- plugin runtime과 소비 repo 설치 경로는 바꾸지 않으므로 monolith plugin version은 `0.62.0`을 유지한다.

## 5. 경계 / Do-Not

- ✅ 해도 됨: OS 임시 디렉터리, disposable CODEX_HOME, fixture Codex CLI, exact tag/commit의 package build,
  read-only 사용자 상태 snapshot.
- ⚠️ 먼저 물어봐: 실제 사용자 plugin 상태 변경, split package 승격, monolith alias 제거, 공개 marketplace 등록.
- 🚫 절대 금지: 사용자 인증정보를 격리 HOME·report·log에 복사; 실제 사용자 plugin/cache 수정; 검사 실패를
  이전 성공·cache로 대체; `installable:false`를 증거 없이 변경.

## 6. Open Questions

없음. 사용자가 v0.62.0 다음 roadmap 작업 진행과 비보안 단계의 재승인 생략을 지시했다. 이번 slice는 가역적인
격리 loader·rollback 증거까지만 수행하며 승격·공개·monolith 제거는 별도 결정으로 남긴다.

## 7. 기술 접근 (HOW)

- `run-codex-split-loader-pilot.mjs`가 exact revision을 `build-packages.mjs --revision`에 전달해 임시 artifact를
  만들고, 그 디렉터리에만 local marketplace manifest를 생성한다. 실행 전 source HEAD·clean 상태를 exact
  revision과 결박하고 `GIT_*`를 제거한 private no-hardlink checkout만 builder 입력으로 사용하며 checked-in
  marketplace는 수정하지 않는다.
- report는 보호 root 밖의 identity-bound canonical parent에서 완성한 단일 임시 파일을 hard link로 새 목적지에만
  게시한다. 임시·최종 파일 inode가 같음을 검증하고 임시 경로는 identity 확인 후 단일 unlink한다. 기존 파일·symlink·source·사용자 `CODEX_HOME` 경로는 쓰기 전에 거부하고 pair rollback과 게시 후
  보호 상태 재검증을 수행한다.
- 각 profile은 별도 격리 HOME에서 실행한다. 실제 Codex subprocess는 `HOME`, `CODEX_HOME`, XDG root와
  `PATH`, locale, temp 관련 비밀 없는 key만 받는다.
- 공식 CLI의 JSON 결과에서 marketplace name, plugin id, version, installedPath를 읽고 생성 artifact와 cache를
  독립적으로 inventory/digest 비교한다. package 제거는 workflow→adapter→core, marketplace 제거는 마지막이다.
- 사용자 상태는 격리 env를 적용하지 않은 `plugin marketplace list --json`과 `plugin list --json`의 canonical
  JSON digest만 전후 비교한다. 보고서에는 digest와 `$TMP`·`$HOME` 비식별 경로만 남긴다.
- fixture CLI는 실제 명령 순서와 상태 파일 side effect를 구현한다. 테스트는 성공, malformed JSON, cache path
  escape, digest drift, install failure, rollback failure를 각각 압박한다.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC 참조 | 대상 파일 | 검증(이 명령 exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | 공식 loader·cache 무결성·rollback runner RED→GREEN | AC-1~7 | `tests/codex-split-loader-pilot-test.sh`, `scripts/run-codex-split-loader-pilot.mjs` | `bash tests/codex-split-loader-pilot-test.sh` | — | |
| 2 | CI 연결과 exact v0.62.0 live 보고서·제품 판정 기록 | AC-8~10 | `.github/workflows/ci-gate.yml`, `docs/pilots/codex-split-loader-v0.61.0.{md,json}`, `docs/product-{direction,boundaries}.md`, `docs/decisions.md` | 신규 테스트 + package/profile/native-loader 회귀 + CI quality 로컬 재현 | #1 | |

### Task 1 실행 계획

- [ ] `tests/codex-split-loader-pilot-test.sh`에 상태를 실제 파일로 보존하는 fixture `codex`를 만들고 성공 profile
  세 개의 설치 집합, core-first 설치, reverse rollback, user-state digest, temp cleanup을 literal 값으로 단언한다.
- [ ] 같은 테스트에 `malformed-list`, `escaped-installed-path`, `mutated-cache`, `install-failure`,
  `rollback-failure` mode를 추가하고 runner가 각 mode에서 nonzero이며 PASS 보고서를 남기지 않음을 RED로 확인한다.
- [ ] `scripts/run-codex-split-loader-pilot.mjs`에 CLI
  `--revision <commit> --json-report <path> --markdown-report <path> [--source <path>]`를 구현한다. fixture에서만
  `CODEX_BIN` override를 허용하고, revision은 commit으로
  resolve하고 generated artifact metadata의 exact SHA를 대조한다.
- [ ] `runCodex(args, env, label)`은 nonzero·malformed JSON을 거부하고, `verifyInstalledArtifact()`는 CLI의
  installedPath canonical containment, manifest identity/version, generated-vs-installed tree digest를 검사한다.
- [ ] `runProfile(profile, units)`은 독립 격리 HOME에서 install→observe→reverse remove→marketplace remove를
  수행하고 `finally` cleanup 결과까지 구조화해 반환한다.
- [ ] target test를 GREEN으로 만든 뒤 `node --check scripts/run-codex-split-loader-pilot.mjs`와 mutation
  반증(설치 순서 또는 digest 검사를 제거하면 test FAIL)을 확인한다.
- [ ] Task 1 파일과 승인된 스펙을 `feat(packaging): Codex split loader rollback pilot 추가`로 원자 커밋한다.

### Task 2 실행 계획

- [ ] CI quality job에 `bash tests/codex-split-loader-pilot-test.sh`를 추가하고 기존 명령 순서를 보존한다.
- [ ] Task 1 commit을 exact revision으로 실제 `codex-cli 0.144.6` pilot에 전달해 JSON/Markdown을 생성하고
  report의 revision·tree·package version·binary digest·세 profile·rollback·user-state 값을 원본과 대조한다.
- [ ] `product-direction.md`와 `product-boundaries.md`에 공식 loader 설치·제거 PASS, dependency/runtime binding·
  model session 미검증, `installable:false` 유지 판정을 기록하고 `decisions.md`에 **연결** 결정을 남긴다.
- [ ] 신규 test, `package-build-test.sh`, `profile-lifecycle-test.sh`, `codex-native-loader-test.sh`,
  `codex-native-loader-pilot-test.sh`를 실행하고 CI quality job을 로컬 재현한다.
- [ ] 보고서·문서·CI wiring을 `docs(pilot): Codex split loader rollback 증거 기록`으로 원자 커밋한다.
