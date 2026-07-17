---
name: repo-sync
description: 소비 프로젝트와 team-harness 표준 자산의 드리프트를 읽기 전용으로 점검할 때 사용. 앱 데이터 동기화·파일 자동 수정·브랜치 보호 적용은 제외
argument-hint: "\"[repo 경로 ...]\" (생략 시 현재 작업 repo)"
effort: low
---

# /repo-sync — team-harness 표준 드리프트 점검

프로젝트가 team-harness 표준과 sync 됐는지 점검한다(드리프트 감지). `templates/`는 신규 셋업에만 적용돼 기존 repo에 자동 전파되지 않으므로, 표준 게이트가 빠진 채 드리프트가 쌓인다. 이 커맨드를 **수동 호출**해 그 공백을 점검한다.

> 단일 출처: `docs/harness-maintenance.md` (기존 repo 드리프트 점검 절).
> 점검 로직은 `${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/check-repo-sync.mjs` — 신규 셋업 `new-repo.sh`의 대칭 도구.

---

## 동작

1. **대상 결정**: 인자로 repo 경로(들)를 받으면 그 repo들, 없으면 현재 작업 repo(cwd) 하나.
2. **각 대상 점검**: 대상마다 실행한다.
   ```bash
   node ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/check-repo-sync.mjs --repo <경로>
   ```
   스크립트가 repo 스택(java·flyway·typescript·nestjs·vite·python·prisma·alembic·supabase)을 파일 신호로 감지하고, 그 스택의 필수 harness 자산(test-guard·commitlint·secret-scan·migration-safety 게이트 + 스택 룰)이 표준과 sync 됐는지 자산별 `OK / WEAK / WARN / MISSING` 표로 출력한다.
   - **exit 1(MISSING 있음)이어도 보고는 계속한다** — 다음 대상도 마저 실행하고 마지막에 종합한다.
3. **브랜치 보호 점검**(gh 인증 필요 · GitHub repo 대상): 표준 솔로 보호(승인0·CI-gate) 적용 여부를 점검한다.
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT:-$HOME/team-harness/plugins/harness-guard}/scripts/set-branch-protection.sh <owner/repo> --check
   ```
   `✗ 보호 미적용`이면 보고에 포함(적용은 `--check` 빼고 실행 — 사용자 승인 후). `--approvals` 없이 `--check`하면 승인 개수는 **정보성**(0/≥1 모두 통과, 드리프트 아님)이고 `enforce_admins`·required checks·**`allow_force_pushes`/`allow_deletions`(=false, 계층0이 force-push·브랜치삭제를 실제 차단하는지 — 재설계 [A]가 force-push를 계층0에 위임하는 전제)**·strict만 엄격 판정한다 — 팀 repo는 `--approvals N`을 함께 줘 그 baseline으로 검증한다(불일치 시 `⚠ 승인요건 불일치`). check-repo-sync.mjs는 무의존 정적검사라 이 네트워크 점검은 별도 스크립트로 분리.

## 보고

- 대상별 한 줄 요약(스택 + OK/WEAK/WARN/MISSING 카운트).
- **MISSING이 있으면**: 어떤 자산이 빠졌는지 나열하고, team-harness `templates/`의 해당 자산에서 **백필 PR을 제안**한다(자동 백필하지 않는다 — 사용자 승인 후 각 repo에 PR).
  - 자산 ↔ 표준 위치 매핑(주요): test-guard·commitlint·secret-scan·ci-gate → `templates/ci/*.yml`, migration-safety → `templates/ci/migration-safety.yml` + `scripts/check-migration-safety.mjs`, 스택 룰 → `templates/rules/stacks/<스택>.md`.
- WEAK(sentinel 없음)/WARN(룰 없음)은 머지를 막지 않는 약한 신호 — 수동 확인 권장으로 안내.
- 전 대상 MISSING 0이면 "표준과 sync — 드리프트 없음"으로 마무리.
