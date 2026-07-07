# Guard/Gate 판정 근본 재설계 — 실행 로드맵 (#220 / #219)

> **성격:** 실행 로드맵(HOW·시퀀싱·게이트). **WHY/근본원인 분석의 원본 = [issue #220](https://github.com/grinvi04/team-harness/issues/220)**
> (중복 서술 금지 — 포인터로 참조). 하위 클러스터 [B] = [issue #219](https://github.com/grinvi04/team-harness/issues/219).

## Context (왜 지금)

가드/게이트 엔진은 **완결 불가능한 것을 완결하려는 접근** 때문에 회귀 whack-a-mole에 갇혀 있다:
정규식으로 셸 명령줄을(셸은 정규언어 아님), 매직상수로 마이그레이션 밴드를(밴드성은 표본 아닌
팀 규약) 판정 → 종료조건 없는 우회-재봉쇄. 실측: **force-push 3회 재작성, migration 9회 패치**.
근본원인 = (1) 원리적 완결 상한 없는 판정 + (2) 오배분된 위협모델(서버-백스톱 있는 넛지에 적대 rigor 적용).

**정정 (원본 재확인 2026-07-07):** #220은 2026-07-06 작성됐고 그 직후 Phase 0이 **실제로 대부분
실행됐다**(아래 스냅샷). 따라서 이 로드맵의 실체는 **Phase 1~4**이며, 심장부는 아직 미착수인
**Phase 2 재설계([A] guard shlex, [B]/#219 migration 선언입력)**다.

---

## 산출물 구조 (단일출처 원칙 — 이게 곧 클러스터 [G]의 주제)

- **이 로드맵 스펙** = 실행 시퀀싱·게이트·클러스터 범위. WHY/분석 원본은 #220 포인터 참조.
- **Phase 2 재설계 [A]·[B]는 L-effort** → 각 phase 도달 시 **전용 `/plan` 스펙**으로 상세 분해.
  지금 태스크까지 분해하지 않는다(도달 전 stale = speculative planning, YAGNI).
- **태스크까지 분해된 범위 = Phase 1(즉시 실행 슬라이스)뿐.** Phase 2~4는 클러스터 범위로 남긴다.

---

## 현재 상태 스냅샷 (원본 재확인, 2026-07-07)

| 클러스터 | 상태 | 근거 |
|---|---|---|
| [C] 위협모델 명문화 + 계층 재라벨 | ✅ **완료** | PR #221 merged. guard.sh 헤더 9–27행 3분류(서버백스톱 넛지/로컬파괴/프로세스 넛지), decisions.md 169행 |
| [J] 서브에이전트 훅 실발동 | ✅ **완료** | 비결함 확정(로그 53줄) |
| [B응급] migration exit1→warn 강등 | ⛔ **하지 않음(결정)** | exit1(머지 차단) **유지**. safe-default 오발은 감수, 정밀 판정은 Phase 2 [B] 재설계로 해결 |
| [D] python3 fail-closed 완화 | ✅ **완료** | PR #239 merged (v0.29.23). 스케치("degraded subset")가 아니라 **python3→jq 폴백**으로 구현 — jq로 전체 가드 그대로 작동(보호 축소 0), 둘 다 부재/실패일 때만 fail-closed. guard.sh 61–78행 |
| [F] break-glass 원자성 | ✅ **완료** | PR #240 merged (v0.29.24). 원자 래퍼 `scripts/solo-merge.sh` — `trap … EXIT INT TERM HUP` 복구 보장 + pre-gate(DELETE 전 차단) + **fail-closed verify**(복구 실패 시 exit1 경보) + python3→jq 폴백. SKILL은 래퍼 호출로 축약 |
| [E] audit 로그 | 🔄 부분 | 규약·마스킹·256KB 로테이션 완료(PR #171·#176). 중앙 ship 미확인 |
| [G] 문서 단일출처 정합 | 🔄 부분 | ⚠️ **전제 낡음**: "decisions.md 80KB 분할" — 현재 ~8–10KB(181줄)라 분할 불필요. 포인터화·grep가드는 유효 |
| [H] 워크플로 핸드오프 | 🔄 부분 | plan mode·milestone 흡수됨. hasSpec 정밀화·spec 수명은 미확인 |
| [I] 온보딩 반증-스모크 | 🔄 부분 | troubleshooting.md 신설(PR #222). 가드 실발동 assert·hooksPath 자동화 미완 |
| [A] guard.sh shlex 재설계 | ❌ 미착수 | 정규식 7벌·PROTECTED_BRANCHES 2곳 하드코딩 여전 |
| [B]/#219 migration 선언입력 재설계 | ❌ 미착수 | GAP_THRESHOLD=100·TIMESTAMP_MIN=1e7·greedy discovery 여전. 9회 패치는 재설계 아닌 safe-default |
| [K] 버전 롤백·canary | ❔ 확인 안 됨 | 관련 커밋 없음 |
| [L] 시크릿 런북 + 파괴 DDL 게이트 | ❔ 확인 안 됨 | 관련 커밋 없음 |

---

## 실행 시퀀싱 (게이트 순서)

- **Phase 1 (전제, near-term):** `[D]` python3 degraded(✅ #239) + `[F]` break-glass 원자성(✅ #240) + repo-sync protection-on 검증(✅ #238+SKILL)
  → Phase 2 [A]의 안전 위임(force-push를 계층0에 넘김) 전제를 만든다. **✅ Phase 1 완료 — Phase 2 진입 가능.**
- **Phase 2 (재설계, L-effort):** `[B]`/#219 → `[A]`. **각각 전용 `/plan`.**
- **Phase 3 (안전망):** `[E]` 중앙 ship · `[F]` 후반 · `[K]` · `[L]` · `[I]` 잔여 — 병렬, 클러스터 범위.
- **Phase 4 (문서위생):** `[G]`(포인터화·grep가드, 80KB 분할은 제외) · `[H]`.

---

## Phase 1 태스크 (즉시 실행 슬라이스 — /feature-add 핸드오프 대상)

> Phase 1을 한 기능 단위로 묶어 순차 개발. 아래는 태스크 스켈레톤 — 착수 시 각 태스크의 수용기준이
> `/feature-add`의 RED 테스트 계약 입력이 된다.

| # | 태스크 | 대상 파일 | 검증(exit 0) | 의존 | [P] |
|---|---|---|---|---|---|
| 1 | ✅ repo-sync에 branch-protection **protection-on 검증** — repo-sync SKILL 3단계가 `set-branch-protection.sh --check`를 오케스트레이션(#238이 `allow_force_pushes`/`deletions` 검증 추가 → [A] 전제 충족). mjs는 무의존 정적검사라 네트워크 점검은 의도적으로 분리(SKILL:30). SKILL에 force-push=[A]전제 명시 | `skills/repo-sync/SKILL.md`, `scripts/set-branch-protection.sh` | `bash tests/set-branch-protection-test.sh` | — | #238 + 본 PR |
| 2 | ✅ `[D]` python3 부재/실패 시 **degraded** — (실구현: **jq 폴백** — 전체 가드 그대로 작동, 둘 다 부재면 fail-closed. 스케치의 "파괴가드만 남김"보다 보호 축소 0) | `plugins/harness-guard/scripts/guard.sh` 61–78행 | `bash tests/guard-test.sh` | — | PR #239 |
| 3 | ✅ `[F]` break-glass **원자성** — solo-merge의 DELETE→merge→PATCH를 `trap … EXIT INT TERM HUP`로 감싸 중단에도 복구 보장 + pre-gate + fail-closed verify | `scripts/solo-merge.sh`(신규) + `skills/solo-merge/SKILL.md` | `bash tests/solo-merge-test.sh` | — | PR #240 |

- 롤백: 세 태스크 모두 독립(`[P]`) — `git revert` 단독 가능. 파괴적 아님.
- 버전 bump 필요(플러그인 동작 변경): guard.sh·solo-merge 변경 시 plugin.json + README 배지.
- **진행: Phase 1 3개 태스크 전부 완료 — 태스크1(repo-sync protection-on, #238+SKILL) · 태스크2([D] #239) · 태스크3([F] #240). → Phase 2([B]/#219 → [A]) 진입 가능, 각기 전용 `/plan`.**

---

## 결정 기록

1. **산출물 구조** — 로드맵 스펙 1장 + Phase 2~4는 도달 시 전용 `/plan`.
2. **[B응급] posture** — exit1(머지 차단) **유지**. warn 강등 안 함. 정밀 판정은 Phase 2 [B]로 이관.

---

## Verification

- Phase 1: `bash tests/guard-test.sh`, `bash tests/repo-sync-test.sh`, solo-merge 중단 복구 재현 — 전부 exit 0.
- 회귀망: guard-matrix(59) + guard-test(125) + migration-safety(18) = 기존 202케이스 GREEN 유지(재설계 시 재사용).
- 전량 게이트: CI `.github/workflows/ci-gate.yml` quality 잡.
- 각 Phase 완료 = 해당 클러스터의 수용기준 충족 + 버전 bump + `decisions.md` 결정 기록.
