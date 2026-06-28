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

버전 변경 시 함께 갱신: `plugins/harness-guard/.claude-plugin/plugin.json` + README 배지.
동작 변경을 머지하고 버전을 안 올리면 팀원에게 배포되지 않은 것과 같다.

## 팀원에게 전파되는 방식

- **플러그인(가드·커맨드·스킬·에이전트)**: 버전 업 → 팀원이 Claude Code `/plugin` 메뉴에서 업데이트.
  동작이 바뀌는 MINOR 이상은 팀 채널에 한 줄 공지
- **templates/**: 새 프로젝트 셋업에만 적용된다 — **기존 프로젝트에 자동 전파되지 않음**.
  기존 프로젝트에 반영이 필요한 변경(CI 게이트, gitignore 등)은 각 프로젝트에 별도 PR + 공지
- **docs/**: 별도 배포 없음 — AGENTS.md 표의 주소가 단일 출처를 가리킨다

## 신규 셋업 ↔ 기존 repo 드리프트 점검 (대칭 도구)

`templates/`가 기존 repo에 자동 전파되지 않는다는 위 한계가 드리프트의 원인이다(예: test-guard
게이트가 일부 repo에 누락). 신규/기존 양쪽을 도구로 닫는다:

- **신규 repo 셋업**: `bash scripts/new-repo.sh` — 표준 자산을 복사하고 branch protection 등록.
  마지막에 `check-repo-sync.mjs`로 self-check를 한 번 돌려 sync를 즉시 확인한다.
- **기존 repo 드리프트 점검**: `node scripts/check-repo-sync.mjs --repo <대상 repo>` — repo 스택을
  파일 신호로 감지하고, 그 스택의 필수 harness 자산(test-guard·commitlint·secret-scan·migration-safety
  게이트 + 스택 룰)이 표준과 sync 됐는지 본다. 자산별 `OK / WEAK / WARN / MISSING` 표를 출력하고,
  **필수 자산이 빠지면 exit 1**(드리프트), WEAK(sentinel 없음)/WARN(룰 없음)은 경고(exit 0).
  오탐 회피: ci-gate 본문은 스택별 커스터마이즈라 존재만 보고, 스택 무관 게이트는 내용 sentinel로
  매칭(완전일치 강요 X), 무관 스택 자산은 스킵.
- **CI 상시 점검(선택)**: `templates/ci/repo-sync.yml` 스캐폴드를 각 프로젝트에 배치하면 team-harness를
  checkout해 PR마다 드리프트를 잡는다(required check 여부는 프로젝트 정책).

## 이 repo의 특수성

- branch protection·ci-gate가 걸려 있지 않다 (템플릿 제공자이지 적용 대상이 아님) —
  대신 `.githooks/pre-commit`(dogfooding)과 PR 관행으로 운영. 팀 규모가 커지면 protection 적용 검토
- `presentation.html` 등 발표 자료는 커밋 대상이 아니다 — repo는 운영 자산만
