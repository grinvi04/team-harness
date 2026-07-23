# 하네스 유지보수 규약

team-harness 자체(플러그인·템플릿·docs)를 고치는 절차. 프로젝트 작업 규약이 아니라
**하네스에 PR을 보내는 사람**을 위한 문서다.

## 변경 절차

1. 브랜치 생성 (`fix/*`·`feature/*`·`docs/*`·`chore/*`) — main 직접 커밋은 이 repo에서도 금지
2. 수정 + 검증
   - 가드(guard.sh) 변경: 차단/허용 시나리오를 `echo '{"tool_name":"Bash","tool_input":{"command":"..."}}' | bash guard.sh`로 실측하고 PR에 결과 기재
   - 문서·커맨드 변경: `/harness-review` 워크플로로 정합성 회귀 검사 (문서 주장 ↔ 구현 동작 교차 검증)
3. **결정이 바뀌면 `decisions.md` 행 갱신 + 영향 문서 수정을 같은 PR에서** (문서 간 모순의 주 원인이 역반영 누락)
4. PR → 셀프 리뷰 → 머지

## 플러그인 버전 정책 (SemVer)

| 변경 | 버전 |
|---|---|
| 가드·커맨드·스킬·에이전트의 **동작 변경/추가** | MINOR (0.x.0) |
| 오타·문구·주석 수정 | PATCH (0.0.x) |
| 호환이 깨지는 변경 (커맨드 제거·settings 키 변경 등) | MAJOR + 마이그레이션 안내 |

버전 변경 시 함께 갱신: `plugins/harness-guard/.claude-plugin/plugin.json` +
`plugins/harness-guard/.codex-plugin/plugin.json` + README 배지.
동작 변경을 머지하고 버전을 안 올리면 팀원에게 배포되지 않은 것과 같다.

## 팀원에게 전파되는 방식

### 분리 package artifact (전환 단계)

`packaging/packages.json`은 governance core, Claude·Codex adapter, workflow pack의 파일 소속과 core 호환
version·runtime binding 정본이다. 아래 명령은 작업트리가 아니라 기록된 Git `HEAD`의 plugin source를 사용해
clean output에 네 staged package를 조립하며, metadata에는 `sourcePluginCommit`과 `catalogDigest`를 분리해 남긴다.

```bash
node scripts/build-packages.mjs --check
node scripts/build-packages.mjs --output /tmp/team-harness-packages
```

정식 릴리즈 검토용 source·staged package bundle은 dirty worktree가 아닌 기록된 `HEAD`에서 만들고 checksum을
검증한다. 이 명령은 태그·GitHub Release·marketplace publication을 수행하지 않는다.

```bash
node scripts/build-release-bundle.mjs --output /tmp/team-harness-release
(cd /tmp/team-harness-release && shasum -a 256 -c SHA256SUMS)
```

생성된 `harness-package.json`의 `installable`이 `false`인 동안에는 marketplace에 등록하거나 기존
`harness-guard`를 대체하지 않는다. v0.60.0부터 아래 명령으로 명시한 filesystem 대상에서 profile 수명주기를
실측할 수 있지만 사용자 plugin cache/config는 변경하지 않는다.

```bash
node scripts/manage-profile.mjs install --profile agent-governed --runtime codex --target /tmp/harness-profile
node scripts/profile-doctor.mjs --target /tmp/harness-profile
node scripts/check-plugin-coexistence.mjs --profile /tmp/harness-profile --plugins /tmp/external-plugins --json
```

공존 검사는 외부 plugin을 실행·수정하지 않고 manifest identity, `plugin:skill` namespace와 hook matcher 중첩만
읽는다. hook lifecycle과 실행 순서는 Claude Code·Codex에 위임하며 보고서의 overlap은 우선순위 주장이 아니다.

독립 소비 repo의 profile 설치 시간·repo-sync backlog·guard 표본을 변경 없이 측정할 때는 output을 대상 repo
밖에 두고 아래 runner를 사용한다. dirty 또는 detached repo는 측정 전에 거부한다.

```bash
node scripts/run-external-pilot.mjs --repo /path/to/consumer --output /tmp/pilot.json
```

- **플러그인(가드·커맨드·스킬·에이전트 기준)**: Claude Code와 Codex 모두 **설치된 버전을 실행**하므로 버전 업 후
  갱신해야 실린다. Claude Code는 `/plugin marketplace update team-harness` 후 `/plugin` 메뉴에서
  harness-guard를 업데이트한다. Codex는 최신 Team Harness checkout에서 아래 한 경로로 plugin 동기화,
  source-native 계약 검사, 외부 security 호환 단계, 새 세션 검증을 순서대로 수행한다.
  ```bash
  bash /path/to/team-harness/scripts/codex-hardened.sh --version
  bash /path/to/team-harness/scripts/harness-doctor.sh --repo . --probe
  ```
  **갱신 안 하면 소비 repo가 옛 버전으로 계속 강제됨** — 예: 감사로 guard 우회·게이트를 고쳐도 캐시가
  0.17.0이면 그 구멍이 소비 repo에 그대로 남는다. 동작이 바뀌는 MINOR 이상은 팀 채널 공지 + 갱신 안내.
- **활성화 구분 (dev vs 소비)**: 소비 repo(`~/project/*`)는 `~/project/.claude/settings.local.json`의
  `enabledPlugins`로 활성(설치형=캐시). **team-harness 자신(플러그인 소스)은 `claude --plugin-dir ./plugins/harness-guard`로
  실행**해 워킹트리 라이브 로드(캐시 stale·shadowing 회피) — 상세는 CLAUDE.md "자기 dogfooding". team-harness를
  `enabledPlugins`에 커밋하면 캐시가 라이브 편집을 가리므로 금지. (스킬 매니페스트는 대문자 `SKILL.md` — 소문자면 발견 불가.)
- **templates/**: 새 프로젝트 셋업에만 적용된다 — **기존 프로젝트에 자동 전파되지 않음**.
  기존 프로젝트에 반영이 필요한 변경(CI 게이트, gitignore 등)은 각 프로젝트에 별도 PR + 공지
- **docs/**: 별도 배포 없음 — AGENTS.md 표의 주소가 단일 출처를 가리킨다

## 신규 셋업 ↔ 기존 repo 드리프트 점검 (대칭 도구)

`templates/`가 기존 repo에 자동 전파되지 않는다는 위 한계가 드리프트의 원인이다(예: test-guard
게이트가 일부 repo에 누락). 신규/기존 양쪽을 도구로 닫는다:

- **신규 repo 셋업**: `bash scripts/new-repo.sh` — 표준 자산을 복사하고 branch protection 등록.
  마지막에 `check-repo-sync.mjs`로 self-check를 한 번 돌려 sync를 즉시 확인한다.
- **기존 repo 드리프트 점검**: `/repo-sync` 스킬(설치 후 어디서나) 또는
  `node plugins/harness-guard/scripts/check-repo-sync.mjs --repo <대상 repo>` — repo 스택을
  파일 신호로 감지하고, 그 스택의 필수 harness 자산(test-guard·commitlint·secret-scan·migration-safety
  게이트 + 스택 룰)이 표준과 sync 됐는지 본다. 자산별 `OK / WEAK / WARN / MISSING` 표를 출력하고,
  **필수 자산이 빠지면 exit 1**(드리프트), WEAK(sentinel 없음)/WARN(룰 없음)은 경고(exit 0).
  오탐 회피: ci-gate 본문은 스택별 커스터마이즈라 존재만 보고, 스택 무관 게이트는 내용 sentinel로
  매칭(완전일치 강요 X), 무관 스택 자산은 스킵.
  단, 커밋 메시지 강제 체인(commit metadata provenance를 포함한 commitlint workflow·commitlint config·
  commit-msg hook·validator)은 정책 코어이므로 action 이름이나 sentinel 존재만으로 `OK` 처리하지 않는다.
  네 자산 모두 team-harness 정본의 정규화된 SHA-256과 일치해야 하며, 대상 파일을 실행하지 않아 드리프트
  검사 중 소비 repo 코드가 실행되지 않는다. 따라서 `if:false`, `continue-on-error`, block scalar 안 가짜 action
  같은 비활성 workflow도 정본 불일치로 차단한다.
  team-harness 자기 자신을 점검할 때는 배포용 `templates/`와 테스트 입력인 `tests/fixtures/`를
  활성 스택 신호에서 제외한다. 이 예외는 `--repo`와 `--harness`가 같은 self-check에만 적용되며,
  repo 루트의 실제 워크플로·설정 자산 검사는 그대로 수행한다.
  stack이 감지된 소비 repo는 rule 파일 존재뿐 아니라 `AGENTS.md`가 `.claude/rules/*.md`를 관련 도구가
  읽도록 지시하는지도 검사한다. Claude는 해당 경로를 자동 로드하고 Codex/Gemini는 AGENTS pointer로 같은
  원문을 명시적으로 읽는다.
  - 스크립트 단일 출처는 **플러그인 안**(`plugins/harness-guard/scripts/check-repo-sync.mjs`) — `/plugin` 설치 시 함께 배포돼 어디서나 동작한다. 루트 `scripts/check-repo-sync.mjs`는 기존 경로(CI 템플릿·테스트·dormant 워크플로)를 위한 위임 shim이다.
- **CI 상시 점검(선택)**: `templates/ci/repo-sync.yml` 스캐폴드를 각 프로젝트에 배치하면 team-harness를
  checkout해 PR마다 드리프트를 잡는다(required check 여부는 프로젝트 정책).

## 이 repo의 특수성

- **develop 채택(v0.14.x)**: team-harness도 다른 repo처럼 `기본=main + develop` gitflow를 쓴다.
  feature→develop→release→main. `ci-gate.yml`은 실제로 있으며 `[main, develop]` PR마다 실행된다.
- **branch protection 적용됨**(2026-07 public 전환 #73 이후) — main·develop에 required status checks·force-push/삭제 차단·대화 resolve·`enforce_admins=on`. 현재 team-harness는 **팀 모드(main 승인1 + stale 승인 무효화, develop 승인0)** 다. `guard.sh` 훅·`.githooks/pre-commit`(dogfooding)은 직접커밋·맨손 gh 머지를 로컬에서 선차단하는 **방어심화 계층**으로 병존(서버 강제와 이중). 드리프트 점검 = `set-branch-protection.sh --check --approvals 1`; main은 옵션 미지정 시 승인 수가 정보성이지만 develop 승인0과 나머지 불변식은 항상 엄격하다.
- `presentation.html` 등 발표 자료는 커밋 대상이 아니다 — repo는 운영 자산만
