# break-glass-atomicity 스펙 ([F] solo-merge 원자성)

> 근거: `docs/specs/guard-gate-redesign-roadmap.md` Phase 1 태스크 3. `/plan` 승인 산출물.

## 1. 목표 & Why

`solo-merge`는 승인요건이 걸린 base 브랜치에서 솔로 개발자가 머지하게 하는 **break-glass**로,
`required_pull_request_reviews`를 **일시 삭제(DELETE) → 머지 → 복구(PATCH)** 한다.

**결함:** 이 3단계가 현재 `solo-merge/SKILL.md` **프로즈**라, AI가 DELETE·merge·PATCH를 각각 별도 Bash
호출로 수동 실행한다. DELETE와 PATCH **사이에 중단**(pr-merge 에러·세션 종료·Ctrl-C·컨텍스트 소진 이탈)되면
**PATCH 미실행 → base 브랜치 보호가 승인요건 삭제된 채 방치**된다(조용히 약화된 보호 → 다음 PR 무승인 머지 위험,
높은 폭발반경).

**목표:** DELETE→merge→PATCH를 **원자적 래퍼 스크립트**로 옮기고 `trap … EXIT INT TERM`으로 감싸,
정상·에러·시그널 어떤 종료 경로에서도 **복구 PATCH가 반드시 실행**되게 한다. SKILL.md는 래퍼를 호출하는
얇은 절차로 축약한다.

**성공 기준(측정 가능):** 중단 주입(fake gh + 실패/시그널 merge)에도 복구 PATCH가 저장된 원본 설정으로
발생함을 테스트가 assert하고 `bash tests/solo-merge-test.sh` exit 0(전 AC GREEN).

## 2. Scope

- **In:** 신규 래퍼 `plugins/harness-guard/scripts/solo-merge.sh`(원자 코어 + trap + pre-gate + verify),
  `solo-merge/SKILL.md` 축약, `tests/solo-merge-test.sh`, CI 등록, 버전 bump.
- **Out (Non-goals):**
  - SIGKILL·전원손실 복구(trap 불가 — 2차 안전망 = repo-sync protection-on 검증, Phase 1 태스크 1 별도 작업).
  - `allow_force_pushes`/`enforce_admins`/status-check 등 **승인요건 외** 보호 토글(절대 안 건드림).
  - pr-merge.sh 게이트 로직 변경(래퍼는 pr-merge.sh를 호출만).

## 3. 기능 요구사항 + 수용기준 (= 테스트 계약)

- **AC-1 (정상):** WHEN pre-gate 통과·HAD_PROTECTION=yes, the system SHALL DELETE→merge→restore 후
  `required_approving_review_count`를 원값으로 복원하고 exit 0.
- **AC-2 (예외·머지실패):** IF merge가 exit≠0 THEN 스크립트가 비정상 종료해도 trap이 restore PATCH를
  원본 설정으로 실행한다(보호 복원). exit≠0.
- **AC-3 (예외·시그널):** IF DELETE 후 SIGTERM/SIGINT 수신 THEN trap이 restore PATCH를 실행한다.
- **AC-4 (경계·보호없음):** WHILE HAD_PROTECTION=no, the system SHALL DELETE도 PATCH도 하지 않는다
  (요건 신규 생성 금지 — 기존 K1 불변식).
- **AC-5 (멱등):** WHEN restore가 명시+trap으로 두 번 트리거돼도, the system SHALL PATCH를 1회만 유효
  적용(중복·상충 없음).
- **AC-6 (경계·pre-gate 차단):** IF pre-gate(CI/스레드/mergeable) 미달 THEN DELETE **이전에** 중단하고
  보호를 건드리지 않는다.

## 4. 제약 / 비기능

- **보안(핵심):** 삭제 대상은 **승인요건뿐**. 다른 보호 필드는 불변. 보호 없던 repo에 요건 신규 생성 금지.
- **한계 명문화:** SIGKILL·전원손실은 trap 불가 — SKILL.md·래퍼 헤더에 명시하고 2차 안전망(repo-sync
  protection-on)을 가리킨다.

## 5. 경계 / Do-Not

- ✅ 래퍼 내부 구조·함수명·로그 포맷 자유.
- ⚠️ pre-gate 판정 기준을 완화하지 말 것(pr-merge.sh·SKILL과 동일). 시그널 목록 변경 시 근거 기록.
- 🚫 품질 게이트(CI·스레드 resolve) 우회 금지. 승인요건 외 보호 토글 금지. 요건 신규 생성 금지.

## 6. Open Questions

- 없음(계획 승인 완료).

---

## 7. 기술 접근 (HOW)

**래퍼 `plugins/harness-guard/scripts/solo-merge.sh`** — pr-merge.sh 컨벤션(`set -euo pipefail`, 헤더 주석,
`[ -n "${SOLO_MERGE_SOURCE_ONLY:-}" ] && return 0` 소스-온리 seam, 순수함수와 gh I/O 분리).

원자적 순서:
1. 인자/전제: `PR`·`OWNER_REPO`·`BASE`.
2. **pre-gate**(보호 건드리기 전): CI required green·commit-status not failure·미해결 스레드 0·mergeable.
   미달이면 DELETE 전 exit(보호 무손상).
3. **save**: `REVIEWS_CONFIG` 전체 저장 + `had_protection`(yes/no). no면 DELETE·PATCH·trap 전부 생략.
4. **arm trap**(yes일 때만): `trap _restore EXIT INT TERM HUP`. `_restore`는 저장 설정에서 4필드
   (`required_approving_review_count`·`dismiss_stale_reviews`·`require_code_owner_reviews`·
   `require_last_push_approval`) PATCH 복원. 멱등(`_restored` 가드 + 성공 후 `trap - …` 해제).
5. **DELETE** 승인요건.
6. **merge**: `bash "${SOLO_MERGE_MERGE_CMD:-<형제 pr-merge.sh>}" "$PR"`(테스트 env 주입). pr-merge가
   CI·스레드·mergeable 재검증 후 머지(게이트 이중). 실패 시 set -e 이탈 → trap 복원.
7. **restore**(명시) + **verify**: `state=MERGED` && review_count=원값. 불일치면 재설정·경고 후 비정상 종료.

**SKILL.md**: Phase 1~3 프로즈 → `bash …/scripts/solo-merge.sh <PR>` 호출로 축약. Phase 0 전제·break-glass
경고·SIGKILL 한계 유지.

**영향 파일:** solo-merge.sh(신규)·solo-merge/SKILL.md·tests/solo-merge-test.sh(신규)·ci-gate.yml·
plugin.json·README.md.

**테스트 전략(AC↔테스트 1:1):**
- 순수함수 단위(`SOLO_MERGE_SOURCE_ONLY=1`): `extract_restore_payload`·`had_protection` → AC-4,5.
- E2E trap 주입(fake bin PATH): fake `gh`(DELETE/PATCH를 로그 기록·원본 config echo) + `SOLO_MERGE_MERGE_CMD`
  fake merge → AC-1(exit0)·AC-2(exit1)·AC-3(kill -TERM)·AC-4(빈 config)·AC-6(gate fail). **반증 기반**:
  복구를 통과가 아니라 중단 주입으로 확인.

## 8. 태스크 (test-first 순서)

| # | 태스크 | AC | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|---|
| 1 | 순수함수(`extract_restore_payload`·`had_protection`) + SOURCE_ONLY seam + 단위테스트 | AC-4,5 | solo-merge.sh, tests/solo-merge-test.sh | `bash tests/solo-merge-test.sh` | — | |
| 2 | 원자 코어(save→trap EXIT/INT/TERM/HUP→DELETE→merge→restore→verify) + 멱등/trap해제 | AC-1,2,3,5 | solo-merge.sh | 〃(E2E 주입) | #1 | |
| 3 | pre-gate 이관(CI/스레드/mergeable) — DELETE 전 차단 | AC-6 | solo-merge.sh | 〃 | #2 | |
| 4 | SKILL.md 래퍼 호출 축약 + SIGKILL 한계·2차망 명문화 | — | solo-merge/SKILL.md | 문서·리뷰 | #2 | [P] |
| 5 | CI 등록 + 버전 bump(plugin.json·README) | — | ci-gate.yml, plugin.json, README.md | CI quality green | #1–4 | |

- **롤백:** 한 feature 브랜치의 원자적 커밋들. PR 단위 `git revert` 가능. 파괴적 아님(프로즈→래퍼 대체는
  우회 완화가 아니라 강화).
