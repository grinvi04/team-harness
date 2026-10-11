---
name: release
description: 사전 검증된 버전을 정식 릴리즈할 때 사용. release 브랜치·main 태그·develop 역병합·헬스체크를 수행하며 hotfix·일반 develop 머지·사전검증 없는 배포는 제외
argument-hint: <version>
---

# /release — 릴리즈 실행 계약

**사용법:** `/release <version>` (예: `/release 1.5.0`).
검증된 develop → release/vX.X.X → main PR·정확한 병합 SHA의 태그 → develop back-merge PR 순서다.
[release-check](../release-check/SKILL.md) 통과가 전제이며, 스킬 호출 자체가 운영 실행 권한을 추가하지 않는다.

## Phase 0 — 원본·후보·권한 확인

- 대상 repo의 `AGENTS.md`, 적용 stack rule, 릴리즈 정책과
  [완료 증거 계약](../verification-before-completion/SKILL.md)을 읽는다.
  빌드·테스트·버전 bump·CHANGELOG 생성·추가 릴리즈 검사·health 명령은 **대상 repo의 AGENTS.md 선언**을 따른다.
  특정 repo의 생성기·경로를 추정하지 않는다. 필수 명령이 없거나 기준이 불명확하면 UNVERIFIED로 중단한다.
- release-check 원본 결과의 후보 OID·환경·검사 범위를 현재 후보와 대조한다. 필수 FAIL/UNVERIFIED이면 NO-GO다.
  이전 성공이나 다른 SHA의 결과로 대신하지 않는다. 미실행 검사는 먼저 실행·판정한 뒤 진행한다.
- `git status --short --branch`와 `git worktree list --porcelain`로 사용자 변경·사용 중인 브랜치를 확인한다.
  기존 작업트리에서 checkout·pull·reset·stash를 하지 않는다. 작업은 별도의 소유된 격리 worktree에서 한다.
  플랫폼의 worktree 기능이 있으면 우선 사용하고 아래 Git 예시는 해당 기능이 없을 때만 사용한다.
  앱의 보관·삭제 제한을 우회하지 않는다. 기존 release/sync 브랜치·경로·태그가 있으면 현재 실행과 일치하는지 확인하며 덮어쓰거나 강제 이동하지 않는다.
- 승인된 원격의 명시 ref만 fetch한다. `VERSION`은 정책이 허용하는 버전(정리 helper는 major.minor.patch)으로
  검증하고, `RELEASE_DIR`·`MERGE_DIR`·`SYNC_DIR`·`CLEANUP_DIR`는 충돌 없는 소유 경로로 정한다.
- 서버가 없는 repo의 staging/production health는 실제 비적용 근거로 SKIP한다.
  서버가 있으나 명령·접근·증거가 부족한 경우는 UNVERIFIED다. 필요한 사전 health가 미확인이면 진행하지 않는다.
  운영 실행·새 인증·유료 도구·추가 비용은 기존 승인 범위를 넘어 실행하지 않는다.

## Phase 1 — 릴리즈 후보 준비

```bash
git fetch origin refs/heads/develop:refs/remotes/origin/develop || exit 1
CANDIDATE_SHA=$(git rev-parse 'refs/remotes/origin/develop^{commit}') || exit 1
# CANDIDATE_SHA와 release-check 후보를 대조한 뒤, 새 worktree·브랜치만 만든다.
git worktree add -b "release/v$VERSION" "$RELEASE_DIR" "$CANDIDATE_SHA" || exit 1
```

이후 후보 준비 명령은 `RELEASE_DIR`에서 실행한다. AGENTS.md에 선언된 버전 bump와 CHANGELOG·생성물
명령을 실행하고, 관련 진행 문서·사용 안내를 실제 단계와 맞춘다. 아직 미실행인 태그·역병합·배포는 완료로 쓰지 않는다.
변경 파일 목록과 전체 diff를 확인한 뒤 **승인된 파일만 명시 경로로 stage**하고 저장소 커밋 규약을 따른다.

```bash
# RELEASE_FILES 배열은 실제 변경을 검토해 승인된 개별 경로로 채운다.
git add -- "${RELEASE_FILES[@]}"
git diff --cached --check || exit 1
git diff --cached
git commit -m "chore(release): v$VERSION 릴리즈 준비"
RELEASE_SHA=$(git rev-parse HEAD) || exit 1
```

## Phase 2 — 최종 후보 검증

- release-check 범위와 `RELEASE_SHA`의 차이를 확인한다. 버전 bump·생성 문서를 포함해 영향을 받는 검사를 실행한다.
  required CI가 같은 후보의 필수 검사를 모두 실행했다면 그 원본 증거를 재사용한다.
  CI가 e2e 등 필수 범위를 포함하지 않으면 해당 명령을 직접 실행한다. 필수 검사를 생략하지 않는다.
- 추가 커밋·리뷰 수정이 생기면 현재 후보로 CI를 재확인하고 변경 범위의 검사를 재실행한다.
  인증·권한·입력 검증·시크릿 변경은 보안 재검토, 마이그레이션 변경은 release-check의 DB 기준으로 재점검한다.
- 고정 모델·에이전트 수를 요구하지 않는다. 단순 검사는 직접 수행하고, 위임할 때만 현재 native 기능과
  승인된 역할·model·effort·예산을 확인한다. Codex에서는 로드된 wrapper의 native 실행 계약을 적용한다.
  정책상 필수 독립 검토는 구현자와 다른 인스턴스가 현재 후보를 직접 읽고 반증한다.
  검증자 위임은 실제 read-only 실행 권한을 확인한 경우에만 시작한다. 역할 이름·worktree·sandbox 설정이나
  요청 문구만으로 쓰기 차단을 가정하지 않는다. 불가하면 필수 검토는 UNVERIFIED다.
- 필수 FAIL/UNVERIFIED가 하나라도 남으면 NO-GO로 중단한다. network·인증·미실행을 SKIP으로 바꾸지 않는다.

## Phase 3 — main PR 게이트·정확한 SHA 태그

[현재 스킬 경로 검증](../../runtime-path.md)을 스크립트를 실행하는 **각 도구 호출**에서 먼저 적용한다.
HOME checkout이나 현재 제품 경로를 플러그인 경로로 추정하지 않는다.

```bash
: "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}"
test -f "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-create.sh" || exit 1
PR_BODY=$(mktemp) || exit 1
```

`PR_BODY`에 버전·변경·검증 후보·결과·남은 단계를 작성한다. 진행 문서 검사 채택 repo는 AGENTS.md의
문서 동기화 계약에 맞는 `harness-doc-sync` 선언 하나를 포함하고, 관련 문서 상태를 현재 후보와 대조한다.
미채택 repo에 선언을 새로 강제하지 않는다. 채택 repo는 push 전에 다음 검사를 통과한다.

```bash
node "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/check-document-sync.mjs" \
  --repo . --record "$PR_BODY" --committed || exit 1
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-create.sh" --base main \
  --title "release: v$VERSION" --body-file "$PR_BODY" || exit 1
PR=$(gh pr view --json number --jq .number) || exit 1
```

머지는 별도의 소유된 **detached `MERGE_DIR` worktree**에서 명시 PR 번호로 실행한다.
래퍼의 로컬 정리가 사용자 checkout을 바꾸거나 사용 중인 base 브랜치를 전환하지 않도록 한다.
현재 release worktree가 브랜치를 사용해 정리가 거부되면 브랜치를 보존하고 병합과 정리를 별도로 보고한다.

[pr-review-gate](../pr-review-gate/SKILL.md)의 전체 절차(1~7단계)를 적용한다. 현재 head/base snapshot에
AI 리뷰·처리한 스레드·필수 사람 승인·required CI·commit-status·mergeability를 연결하고 머지 래퍼를 사용한다.
main/develop에 직접 커밋·push하지 않으며, 맨손 PR 생성·머지나 보호 정책 완화로 통과시키지 않는다.
승인된 보호 예외·복구 경로를 사용했다면 실행 전 전체 정책과 복구 후 실제 API 원문을 대조한다.
조회 실패·복구 실패·불일치는 중단 사유다. 표준 설정 검사만으로 원래 예외 정책의 복구를 증명하지 않는다.

main PR 병합 확인 후 다음을 실행한다. 각 조회·비교 실패는 태그 발행 전에 중단한다.

```bash
PR=$(gh pr list --state merged --base main --head "release/v$VERSION" --json number \
  --jq 'if length == 1 then .[0].number else empty end') || exit 1
[ -n "$PR" ] || exit 1
MERGE_SHA=$(gh pr view "$PR" --json state,mergeCommit --jq 'select(.state == "MERGED") | .mergeCommit.oid') || exit 1
[ -n "$MERGE_SHA" ] || exit 1
git fetch origin refs/heads/main:refs/remotes/origin/main || exit 1
[ "$(git rev-parse origin/main)" = "$MERGE_SHA" ] || exit 1
git cat-file -e "$MERGE_SHA^{commit}" || exit 1
# 기존 동명 local/remote tag가 있으면 덮어쓰지 않는다. 조회 실패도 중단한다.
git tag v$VERSION "$MERGE_SHA" || exit 1
git push origin "refs/tags/v$VERSION" || exit 1
```

발행 후 원격 exact tag ref를 다시 조회하고 peeled commit이 `MERGE_SHA`인지 확인한다.
main이 이후 이동했거나 조회가 실패하면 임의 최신 SHA에 태그하지 않는다. 이미 발생한 병합·태그 효과를 그대로 보고한다.

## Phase 4 — develop back-merge·안전한 정리

main 기준의 새 `sync/backmerge-v$VERSION` 브랜치를 `SYNC_DIR`에 만든다. 현재 main ref를 명시적으로
fetch·확인하고 태그 SHA의 포함 관계를 확인한다. 사용 중인 main/develop을 checkout하거나 pull하지 않는다.
back-merge도 직접 push 없이 PR로 진행한다.

```bash
git worktree add -b "sync/backmerge-v$VERSION" "$SYNC_DIR" refs/remotes/origin/main || exit 1
```

`SYNC_DIR`에서 별도 본문 파일에 main PR 번호·태그·현재 반영 범위·단계별 증거를 작성한다.
문서 검사 채택 repo는 현재 상태의 선언·기록을 커밋하고 같은 `--committed` 검사를 실행한다.
main 병합·태그 이전 본문을 그대로 복사하지 않는다.

```bash
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/pr-create.sh" --base develop \
  --title "chore: release/v$VERSION develop 반영" --body-file "$BACKMERGE_BODY" || exit 1
```

[pr-review-gate 부록](../pr-review-gate/SKILL.md#부록--back-merge-pr-간소-게이트)은 main PR과 내용이 동일할 때만
적용한다. 현재 보호 정책의 사람 승인 요건·CI·후보 결박·머지 래퍼는 유지한다. 보호 조회 실패는 UNVERIFIED다.
문서 수정·충돌 해소 등 추가 변경이 있으면 전체 게이트로 재검토한다. 충돌은 소유한 sync worktree에서
명시적으로 fetch한 develop을 merge해 해소하며, 변경 후 검사·게이트를 다시 통과한다.
머지 실행은 별도의 소유된 detached worktree에서 한다. 실제 MERGED와 main 변경의 develop 포함을 확인한다.

정리 helper는 **develop checkout에서만** 실행된다. 명시 develop fetch 뒤 로컬 develop이 원격과 같고
다른 worktree에서 사용하지 않을 때만 별도 `CLEANUP_DIR`에 연결한다. 없거나 다르거나 사용 중이면
reset·강제 생성·전환하지 않고 정리를 UNVERIFIED로 남긴다. 소유한 release/sync worktree는 변경이 없는지
확인한 뒤 detach 또는 제거하며, 사용자 worktree와 변경은 보존한다.

```bash
# 위 조건을 확인해 안전하게 만든 CLEANUP_DIR에서만 실행한다.
bash "${HARNESS_PLUGIN_ROOT:?먼저 현재 스킬 경로를 검증하세요}/scripts/release-cleanup.sh" "$VERSION"
```

정리 출력·종료 코드를 별도 기록한다. develop에 병합되지 않은 로컬·원격 tip은 보존한다.
추적 원격의 병합만으로 로컬 삭제를 허용하지 않고 원격 삭제는 조회한 OID에 결박한다.
사용 중인 로컬 branch를 강제 삭제하지 않는다. 정리 실패·조회 미확인은 병합 실패와 구분한다.

## Phase 5 — 단계별 증거·health 보고

AGENTS.md의 배포 대기·health 기준은 승인된 관찰 범위에서 실행한다. 정의된 timeout·간격·대상 SHA를 기록한다.
운영 실행 승인이나 접근이 없으면 UNVERIFIED로 보고하고 멈춘다. 서버가 실제 없으면 health만 SKIP이다.
필수 배포·health의 FAIL/UNVERIFIED는 해당 단계 완료를 막으며, 성공한 Git 단계와 별도로 보고한다.

| 단계 | 판정 | 증거 |
|---|---|---|
| main 병합 | PASS/FAIL/UNVERIFIED | PR·검증 head/base·merge SHA·gate |
| 태그 발행 | PASS/FAIL/UNVERIFIED | exact tag ref·원격 peeled SHA |
| develop 역병합 | PASS/FAIL/UNVERIFIED | PR·MERGED·포함 관계 |
| 정리 | PASS/FAIL/UNVERIFIED/SKIP | 실제 삭제·보존·미확인과 종료 코드 |
| 설치·배포·health | PASS/FAIL/UNVERIFIED/SKIP | 항목별 실행·후보·환경 또는 실제 비적용 근거 |

미실행 설치·배포·프로덕션 정상 상태를 만들어 보고하지 않는다. 각 단계의 남은 행동·복구 상태를 기록한다.
