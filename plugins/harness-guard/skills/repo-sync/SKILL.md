---
name: repo-sync
description: 소비 프로젝트와 team-harness 표준 자산의 드리프트를 읽기 전용으로 점검할 때 사용. 앱 데이터 동기화·파일 자동 수정·브랜치 보호 적용은 제외
argument-hint: "\"[repo 경로 ...]\" (생략 시 현재 작업 repo)"
---

# /repo-sync — team-harness 표준 드리프트 점검

스크립트 실행 전 [현재 스킬 경로 검증](../../runtime-path.md)을 각 도구 호출에서 적용한다.

프로젝트가 team-harness 표준과 sync 됐는지 점검한다(드리프트 감지). `templates/`는 신규 셋업에만 적용돼 기존 repo에 자동 전파되지 않으므로, 표준 게이트가 빠진 채 드리프트가 쌓인다. 이 커맨드를 **수동 호출**해 그 공백을 점검한다.

> 단일 출처: `docs/harness-maintenance.md` (기존 repo 드리프트 점검 절).
> 점검 로직은 `${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/check-repo-sync.mjs` — 신규 셋업 `new-repo.sh`의 대칭 도구.

---

## 동작

1. **대상 결정**: 인자로 repo 경로(들)를 받으면 그 repo들, 없으면 현재 작업 repo(cwd) 하나.
2. **각 대상 점검**: 대상마다 실행한다.
   ```bash
   node ${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/check-repo-sync.mjs --repo <경로>
   ```
   스크립트가 repo 스택(java·flyway·typescript·nestjs·vite·python·prisma·alembic·supabase)을 파일 신호로 감지하고, 그 스택의 필수 harness 자산(test-guard·commitlint·secret-scan·migration-safety 게이트 + 스택 룰)이 표준과 sync 됐는지 자산별 `OK / WEAK / WARN / MISSING` 표로 출력한다.
   - **exit 1이어도 보고는 계속한다** — MISSING 출력이 있으면 누락으로, 실행·조회 오류이면 미확인으로 보존한다.
     종료 코드와 요약 모두 수집하고, 요약 누락을 MISSING 0으로 채우지 않는다. 다음 대상도 실행하고 종합한다.
3. **브랜치 보호 점검**(gh 인증 필요 · GitHub repo 대상): 표준 솔로 보호(승인0·CI-gate) 적용 여부를 점검한다.
   ```bash
   bash ${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/set-branch-protection.sh <owner/repo> --check
   ```
   `✗ 보호 미적용`이면 보고에 포함(적용은 `--check` 빼고 실행 — 사용자 승인 후). `--approvals` 없이 `--check`하면 승인 개수는 **정보성**(0/≥1 모두 통과, 드리프트 아님)이고 `enforce_admins`·required checks·**`allow_force_pushes`/`allow_deletions`(=false, 계층0이 force-push·브랜치삭제를 실제 차단하는지 — 재설계 [A]가 force-push를 계층0에 위임하는 전제)**·strict만 엄격 판정한다 — 팀 repo는 `--approvals N`을 함께 줘 그 baseline으로 검증한다(불일치 시 `⚠ 승인요건 불일치`). check-repo-sync.mjs는 무의존 정적검사라 이 네트워크 점검은 별도 스크립트로 분리.
   인증·API·조회 실패는 보호 없음이나 정상 보호로 추정하지 않고 UNVERIFIED로 기록한다.
   GitHub가 아닌 대상은 이 보호 검사를 SKIP하고 실제 비적용 이유를 남긴다.

## 보고

- 대상별 한 줄 요약: 스택·OK/WEAK/WARN/MISSING 카운트 + 보호 검사 결과·UNVERIFIED 여부·실행 명령/종료 코드.
- **MISSING이 있으면**: 어떤 자산이 빠졌는지 나열하고, team-harness `templates/`의 해당 자산에서 **백필 PR을 제안**한다(자동 백필하지 않는다 — 사용자 승인 후 각 repo에 PR).
  - 자산 ↔ 표준 위치 매핑(주요): test-guard·commitlint·secret-scan·ci-gate → `templates/ci/*.yml`, migration-safety → `templates/ci/migration-safety.yml` + `scripts/check-migration-safety.mjs`, 스택 룰 → `templates/rules/stacks/<스택>.md`.
- MISSING 0이어도 WEAK/WARN 카운트와 자산명, UNVERIFIED와 확인하지 못한 항목을 생략하지 않는다.
- WEAK(sentinel 없음)/WARN(룰 없음)은 수동 확인이 필요한 약한 신호다. exit 0을 모든 검사의 PASS로 바꾸지 않는다.
- 정적 검사에서 MISSING/WEAK/WARN 모두 0이면 **검사한 정적 자산 범위에서 불일치 미검출**로 보고한다.
  보호 검사는 그와 별도다. 조회 실패는 UNVERIFIED이며, 필수 미확인이 남으면 전체 sync 완료로 판정하지 않는다.
- 파일·sentinel·선언 검사는 문서 의미·적합성이나 누락 없는 검토를 보장하지 않는다. 확인한 범위와 한계를 함께 보고한다.
