# harness-full-audit 스펙 (team-harness 전면 정합·품질 수정)

> 6축 감사(43 에이전트·적대검증)로 확정한 26건(medium 17·low 9)을 5개 테마 PR로 수정. 대상=team-harness.

## 1. 목표 & Why

신설 AGENTS/CLAUDE를 정본 계약으로 team-harness 전체를 exhaustive 검토 → 5 근본원인:
- **T1** 솔로 표준 전환(enforce_admins false→true·승인0·public)의 문서 역반영 누락.
- **T2** guard.sh 정규식 종단/앵커 불일치(우회 4 + 과차단 1).
- **T3** 안전 게이트 fail-open/침묵실패.
- **T4** 하네스 도구 행위 테스트 공백(load-bearing 로직 무테스트).
- **T5** provisioner(new-repo)↔verifier(check-repo-sync) 비대칭.
- (교차) review축(승인수) vs status-check축(enforce_admins) 반복 혼동.

**성공 기준:** 26건 전량 수정 + 재발방지 테스트, 전 tests 회귀 0, T1 잔여 grep 0, 5 repo 실보호 실측 일치.

## 2. Scope

- **In:** 26건 수정(클러스터 A~E), 버전 0.19.3→0.20.0, 5 repo 라이브 실측(F).
- **Out:** erp 제품 코드, guard 매처 전면 퍼즈, 소비 repo 소급, migration 입력 전수 퍼즈.

## 3. 수용기준 (테마별) — 상세는 계획서 §2

- **A(guard T2):** -fu/+HEAD:main force 차단(A1), git -C 커밋 dir 판정(A2), 슬래시無 dir삭제 차단(A3), node_modules&&체인 차단(A4), commit 단어 과차단 제거(A5), guard-test 회귀 0(A6).
- **B(fail-open T3):** set-branch-protection 빈 checks→경고+rc1·--check 판정(B1), migration Math.min 타임스탬프(B2), migration 주석라인 제외(B3), new-repo 실패 non-zero exit(B4).
- **C(문서 T1):** decisions:79 대체마커+경로(C1), harness-maintenance:56 현행화(C2), onboarding PR1→승인0(C3), solo-merge off→on(C4), templates/AGENTS 조건부 승인(C5), AGENTS 경로 정정(C6), repo 전역 grep 잔여 0(C7).
- **D(테스트 T4):** pr-merge 게이트 본체 seam+테스트(D1), guard 안전경로 테스트(D2), pr-create(D3), set-branch-protection --check(D4), new-repo(D5), design-tokens node --check(D6), RED 잔재주석(D7).
- **E(T5+):** alembic 대칭(E1), ruleMap nextjs/vue(E2), 0.20.0(E3), README 21(E4).
- **F:** 5 repo × main/develop --check 실측(승인0·enforce_admins on·checks non-null).

## 4. 경계 / Do-Not

- ✅: guard 정규식 수정+테스트, 게이트 fail-closed화, 문서 정정, 테스트 seam, 버전.
- ⚠️ 먼저 물어봐: guard 공유 헬퍼 규모, alembic-heads (a)제공 vs (b)warn.
- 🚫: 우회 목적 가드 완화, 게이트 fail-open, decisions append-only 값 덮어쓰기, 테스트 스킵.

## 5. 태스크 (테마 PR)

| PR | 브랜치 | AC |
|---|---|---|
| P1 | fix/guard-regex | A1~A6 |
| P2 | fix/gate-fail-open | B1~B4 |
| P3 | fix/doc-drift | C1~C7 |
| P4 | fix/harness-test-coverage | D1~D7 |
| P5 | fix/provisioner-version-readme | E1~E4 (0.20.0) |
| F | (수동 터미널) | F1 |

## 6. Verification

각 PR develop 대상·CI green·회귀 0. P3는 grep 6토큰=0. P5는 plugin.json==README==0.20.0. F는 라이브 --check.
