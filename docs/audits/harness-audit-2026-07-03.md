# team-harness 규칙셋 건전성 감사 (0→100) + erp 준수 파일럿

- 일자: 2026-07-03
- 스코프: Track A = team-harness 전량(150 git-tracked 파일), Track B = erp 파일럿
- 방법론 계획·2라운드 독립검증: 세션 아티팩트(`harness-audit` 스펙 v4)
- 결과: **team-harness 17건 발견**(HIGH 5·MED 5·LOW 7), erp 0건(준수)

## 1. 배경 & 방법론

세션에서 판단-의존 게이트 우회가 드러났다: `/feature-add`는 `/plan` 하류로 설계됐으나 승인된 plan 아티팩트를 선행조건으로 **명시도 강제도 하지 않는다**(관례이지 계약 아님). 이는 개별 결함이 아니라 **"규칙이 의도가 아니라 인스턴스로 인코딩되거나, 강제 없이 판단에 의존하는"** 결함 부류다. 규칙셋 전체를 이 렌즈로 감사했다.

방법(중복 없이 기존 자산 재사용):
- **기존 엔진 재사용**: `/harness-review`(7관점 정합성 + 발견별 적대검증) 실행 — 재발명 안 함.
- **엔진 자기감사**: 엔진 DIMENSION 대상 경로 실존검증(엔진 자신의 dead reference 발견).
- **커버리지 매트릭스**: 150파일 → 리뷰방법 매핑, 미매핑 0(엔진이 안 보는 스킬 14·스크립트 6 명시 편입).
- **블라인드 패스**: 사전등록 중립 프롬프트로 전 스킬 강제vs판단 분류(독립 재발견).
- **적대검증**: 모든 발견 file:line + 반증 라운드(과장 발견 하향/폐기).

## 2. 커버리지 (AC-1·2a) — 미매핑 0

150 git-tracked 파일을 16개 그룹으로 파티션, 각 그룹에 리뷰방법(엔진관점/명시리뷰/블라인드패스/스크립트테스트/실존만) 매핑. 미매핑 0.

**AC-2a 확정(엔진 스코프 갭)**: `harness-review.js` 7관점은 skills 진입계약 중 **pr-review-gate 1개만**, enforcement 스크립트 중 **guard.sh 1개만** 대상으로 읽는다. 나머지 14 스킬·6 스크립트는 엔진 스코프 밖 → 명시리뷰·블라인드패스로 커버(이 감사가 메운 구멍).

## 3. 수용기준 결과

| AC | 결과 |
|---|---|
| AC-1 커버리지 | ✅ 150/150 매핑, 미매핑 0 |
| AC-2a 엔진 스코프 갭 | ✅ skills 14·scripts 6 엔진 미커버 확정 |
| AC-2b 독립 재발견 | ⚠️ **PARTIAL PASS** — 방법론이 결함 부류(하류가 상류를 관례로 전제)를 힌트 없이 독립 재발견(solo-merge·release). feature-add 인스턴스는 *부재* 선행조건이라 "명시 열거" 프롬프트로 미표면화 → 명시리뷰가 직접 확정(F5). 방법론 한계(부재-선행조건 렌즈) 기록. |
| AC-2c 엔진 dead-path | ✅ 2건(F1·F2) |
| AC-3 근거 형식 | ✅ 전 발견 file:line |
| AC-4 적대검증 | ✅ 엔진 3건 오탐 폐기 + 블라인드 2건 하향(F3·F4) |
| AC-5 준수 재현성 | ✅ check-repo-sync 2회 동일 |
| AC-6 fixture/주입 | ✅ 스크립트 테스트 탐지 + 클론 §참조 주입 탐지(+실제 E10 덤 발견) |
| AC-7 divergence 분류 | ✅ erp 0건(분류 대상 없음, 음성 대조군) |

## 4. 발견 (Track A — team-harness)

### 🔴 HIGH
| ID | 위치 | 요지 | remedy → seam |
|---|---|---|---|
| **F5** | `skills/feature-add/skill.md:38-46` | **근본원인.** feature-add가 상류 plan/spec 승인을 선행조건으로 명시·강제 안 함(하류 스킬 중 유일 무방비 — F3·F4는 보상 게이트 있음). | **상태 기반 진입 계약**: 승인 spec 존재 or 명시 trivial 면제 요구(decisions.md:46 부합, 키워드 아님) → feature-add Phase 0 |
| **E1** | `templates/ci/integration-e2e.yml:19` vs `scripts/new-repo.sh:60` | job명 `gate`≠required check명 `integration-e2e` → 등록된 required check 영구 미충족 → **모든 머지 차단**(온보딩 PR 포함) | job명을 `integration-e2e`로 |
| **E2** | `docs/onboarding.md:5-6` | public 전환 결정(#73) 역반영 누락, 여전히 private 서술 | onboarding + 인접 문서 갱신. ⚠️ branch protection 정책 재확인 |
| **F1** | `harness-review.js:48,55` | 엔진 `commands-gate` 관점이 부재 디렉터리 `commands/` 참조 → 거짓 clean | 대상 경로를 `skills/`로 + 엔진 대상 실존 CI 체크 |
| **F2** | `harness-review.js:71` | 엔진 `standards-impl`가 부재 `commands/release-check.md` 참조 | 경로를 `skills/release-check/skill.md`로 |

### 🟡 MEDIUM
| ID | 위치 | 요지 |
|---|---|---|
| **E3** | `skills/pr-review-gate/SKILL.md:91` | solo-merge 우회를 폐기된 `enforce_admins 토글`로 기술(실제는 required_pull_request_reviews 삭제·복구) — 단일출처 드리프트 |
| **E4** | `docs/architecture-diagram-standards.md:4,15,186` | 다이어그램 포맷 상충(.svg vs readme-standards의 mermaid→.png) |
| **E5** | `templates/AGENTS.md:73-78` | guard.sh가 차단하는 "검증기 삭제"가 AGENTS.md 금지사항에 없음(강제↔문서 불일치) |
| **E6** | `README.md:224-230` | 구조 트리가 스택 템플릿 2개(nextjs·vue) 누락(new-repo는 8개 제공) |
| **F6** | `scripts/route-intent.mjs:20-36` | `isActionable()` substring 매칭 조잡 — "정리해줘"·"배포판"(feature+committed) 오유도(라이브 재현). "오버트리거 0" 서술과 모순, 미검 |

### 🟢 LOW
| ID | 위치 | 요지 |
|---|---|---|
| **E7** | `skills/feature-merge/skill.md:74` | Phase 5 수동 브랜치 삭제가 pr-merge.sh `--delete-branch`와 중복 → 원격 삭제 에러 |
| **E8** | `docs/code-review.md:30` | "AI가 분류기에 막혀 보호토글 못함" 주장이 solo-merge 설계·guard.sh·인접 line 31과 모순(자기모순) |
| **E9** | `docs/decisions.md:25` | `release-check.md` 참조 깨짐(파일 이전, F2와 동일 근원) |
| **E10** | `docs/operations.md:133` | 자기 문서에 없는 `§금지사항` 참조(실제=ai-collaboration.md) |
| **F3** | `skills/solo-merge/skill.md:25` | "pr-review-gate 완료" 전제 중 기계화 불가한 "/code-review 처리"만 prose(Phase 1이 CI·스레드·mergeable은 재검증 — 적대검증으로 HIGH→LOW 하향) |
| **F4** | `skills/release/skill.md:26` | release-check 통과 전제(강한 prose+ci-gate 보상 — MED→LOW 하향) |
| **F7** | `scripts/merge-permissions.mjs:43-47` | fragment 부재를 무진단 skip(잠복 취약, 현재 활성 인스턴스 없음) |

### 정합 확인(발견 없음, 근거)
guard.sh PR차단(12케이스 1:1), new-repo.sh 전량복사, check-migration-safety(erp 37파일 실측), pr-create/merge 게이트, merge-permissions 병합로직 — 문서 주장과 코드 1:1 일치.

## 5. Track B — erp 준수 (파일럿)

- 도구(check-repo-sync): **10/10 OK**, 2회 결정론 재현, 드리프트 0.
- 내용 spot-check: 커밋 컨벤션 최근 30커밋 위반 0(v0.13.0 이후 2건 — 표본 명시), clean-arch 4모듈×3계층 완비, DB 마이그레이션 안전성 PASS.
- **divergence 0** — erp는 준수. Track B 파일럿은 방법론이 clean repo에서 거짓양성을 안 냄을 실증(음성 대조군). 나머지 3개 프로젝트 확장은 방법론 확정 후.

## 6. 우선순위 개선 백로그 (수정은 별건 /feature-add)

1. **F5 (근본해결)** — feature-add 진입 계약 조이기. 이 감사의 발단이자 결함 부류의 대표. seam = feature-add Phase 0 + route-intent 상태 신호.
2. **E1** — integration-e2e job명 정정(머지 전면 차단, 최우선 실동작 버그).
3. **F1·F2·E9** — release-check 경로 이전 역반영(엔진 DIMENSION·decisions.md) + 엔진 대상 실존 CI 체크.
4. **E2** — public 전환 문서 역반영 + branch protection 정책 재정리.
5. **E3·E5·E8** — solo-merge/보호토글 관련 문서 3건 단일출처 정합.
6. **E4·E6·E10·F6·F7·E7** — 개별 정정.

## 7. 메타: 이 감사가 스스로 입증한 것

- **엔진 재감사 결정의 정당성**: 신뢰 오라클(harness-review.js) 자신이 dead reference(F1·F2)를 품고 있었다. 엔진을 스코프에 넣지 않았으면 두 관점의 거짓 clean을 놓쳤다.
- **적대검증의 자정**: 블라인드 패스의 과대분류(F3·F4)를 적대검증이 정확히 하향. 엔진도 오탐 3건 폐기.
- **결함 부류의 실재**: "하류가 상류를 관례로 전제"가 feature-add뿐 아니라 solo-merge·release·pr-review-gate 드리프트로 반복 출현. 개별 패치가 아니라 **진입 계약을 상태 기반으로 조이는** 구조적 해결이 정당함을 데이터가 지지.
