# 단계 2 — QA·리뷰·복구·delivery 판정

선행: [단계 1](01-safety.md)의 관련 경계. 근거: [S09–S10](../review/01-safety-runtime.md), [Q01–Q12](../review/02-qa-delivery.md).
진행 상태: QA 상태·필수 CI 조회 실패·복구/태그 반례와 직접 소비자 시험을 통과했다. 실제 PR #507 원자 병합/보호 전체 복원·정확한 SHA 태그 발행은 [전달 기록](../execution-delivery.json)에 연결했다.

## 2A — PR head/base와 리뷰 thread 범위

수정: `plugins/harness-guard/scripts/pr-merge.sh`, `skills/pr-review-gate/SKILL.md`와 직접 참조 문서.
시험: `tests/pr-merge-auto-test.sh`, `tests/pr-create-test.sh`, `tests/flagship-skills-test.sh`의 관련 계약.
인터페이스: 검증한 head/base·처리한 thread ID → 동일 후보의 merge/resolve 요청.

- [x] fake gh에서 검토 뒤 head 변경·base 변경·새 unresolved thread 생성을 재현한다.
- [x] merge는 검증한 head를 공식 `--match-head-commit`으로 결박한다.
- [x] base 재조회 실패/변경은 재검토로 돌린다. 서버의 원자적 base 보호 여부는 실제 지원과 구분해 기록한다.
- [x] 해결 요청은 처리했던 thread ID로 제한하고 새 thread는 미처리 상태로 유지한다.
- [x] 정상 develop 자동머지와 필수 CI/리뷰 거부 계약을 위 시험으로 확인한다.

AC-Q1: 후보 변경·조회 실패에서 완료 판정 없음. 새 thread의 일괄 해결 없음.
base 재조회만으로 원자적 race 제거를 주장하지 않는다. 서버 보호가 필요하면 정확한 계약/한계를 남긴다.

2026-10-09 추가 독립 리뷰: required checks 조회 실패 뒤 unrelated head Actions 성공만으로 `--auto`를 허용하던 경로를 차단했다.
[추가 수정 기록](../execution-integrated-review.json): 첫 RED exit1(56 PASS/2 FAIL) → 수정 후 merge 58·solo 65·pr-create 9·guard 168 PASS 및 구문 exit0.
자동머지는 required 없음·조회 실패에서 fallback 조회와 merge 쓰기를 하지 않는다. 명시 수동 fallback은 기존 계약을 유지하며 전체 서버 필수 context의 증거로 취급하지 않는다.
정상 자동머지의 reviewed head 결박·base 재조회·unresolved/mergeable gate는 유지했다. 실제 서버 보호·CI·머지와 원자적 base race 제거는 미확인이다.

## 2B — solo 복구·hotfix 태그

수정: `scripts/solo-merge.sh`, `scripts/set-branch-protection.sh`, `skills/solo-merge/SKILL.md`, `skills/hotfix/SKILL.md`.
위 경로는 `plugins/harness-guard/` 아래다. 안내: `docs/code-review.md`, `docs/operations.md`.
시험: `tests/solo-merge-test.sh`, `tests/set-branch-protection-test.sh`, `tests/flagship-skills-test.sh`.

- [x] 승인 정책 snapshot과 복원 후 실제 fake API 응답을 비교하는 회귀를 추가한다.
- [x] 정상/중간 실패/복원 API 실패/조회 실패를 각각 관찰한다.
- [x] 기존 policy 전체 보존을 확인하고 복원 미확인을 성공 표현으로 바꾸지 않는다.
- [x] hotfix는 승인 PR의 merge SHA에 대상 태그 하나만 생성/push하도록 계약을 통일한다.
- [x] 추가 로컬 태그·최신 main 이동·다른 SHA의 증거를 거부한다.

AC-Q2: 성공 주장은 저장 정책과 실제 복원 결과 일치 때만 가능. 실패 시 대상·복구 필요를 명확히 보고한다.
force-push 복구를 지원하지 않는 wrapper에 그 기능을 추가하지 않는다. 잘못된 안내를 바로잡는다.
과거 PR #489의 일회성 승인으로 새 보호 예외를 허용하지 않는다.

## 2C — CI 검사 실패·시험 검출력

수정: `templates/ci/alembic-heads.yml`, `.github/workflows/test-guard.yml`, `templates/ci/test-guard.yml`.
기존 시험: `tests/alembic-heads-test.sh`, `tests/new-repo-test.sh`, 관련 test-guard 호출부.
필요한 회귀가 없으면 `tests/test-guard-test.sh`를 만들고 quality CI에 연결한다.
인터페이스: 적용 조건·실제 test 실행/단언 → 유효한 gate 종료값.

- [x] alembic.ini 없음은 실제 비적용, 존재하지만 설치/heads 실행 실패는 실패로 구별한다.
- [x] test-guard의 현재 주요 check/case_ 시험 형태를 판정 범위에 포함한다.
- [x] 단언 제거/전부 제거를 count gate로, 강제 실패/0개 실행을 실제 runner로 따로 관찰한다. count만 같은 변이는 이 gate가 검출하지 못한다.
- [x] count 감소만으로 전체 의미 무결성을 보장하지 않는다고 안내한다.
- [x] 새 template를 소비하는 new-repo 결과와 해당 시험을 함께 확인한다.

AC-Q3: 적용 가능한 Alembic 실행 실패를 PASS로 만들지 않는다. count gate는 기존 단언 전부 제거·조회 실패를 거부하고 정상 시험 형태를 보존한다.
실제 실행 실패/빈 실행의 완료 판정은 별도의 필수 runner 증거로 확인하며 count gate의 통과로 채우지 않는다.
CI 이름·exit 0만 확인하는 시험은 부족하다. 원래 결함을 잡는 판정자를 연결한다.

## 2D — 불확실성·누락·마일스톤 완료

수정: `.claude/workflows/harness-review.js`, `plugins/harness-guard/skills/repo-sync/SKILL.md`, `skills/milestone/SKILL.md`.
검사: workflow 실제 가용성 확인, 순수 verdict 입력, `tests/repo-sync-test.sh`, `tests/flagship-skills-test.sh`.

- [ ] uncertain/isReal false/null을 확인된 기각·정상 미검출과 구분하는 입력을 고정한다.
- [ ] 현재 플랫폼에서 workflow가 활성 경로인지 확인한다. 비활성/미지원이면 제거·기록 이전의 직접 계약부터 판정한다.
- [ ] MISSING 0 요약에 WEAK/WARN/조회 실패를 함께 보존한다.
- [ ] closed issue/취소/중복과 AC 충족을 구분하고 후보·시험에 연결된 완료만 표시한다.
- [ ] 선언만 검사하는 doc-sync checker의 의미/누락 범위 한계를 유지한다.

AC-Q4: UNVERIFIED가 rejected/PASS/완료로 변환되지 않는다. 파일/선언 존재를 실행 증거로 부르지 않는다.
단계 4의 문서 분할은 이 계약을 유지하며 관련 reader를 같이 변경한다.

2026-10-09 추가 독립 리뷰: findings 형식이 유효해도 review `status`가 없거나 null이면 범위 완료로 처리하던 결함을 고쳤다.
[추가 수정 기록](../execution-integrated-review.json): 실제 workflow 행동 회귀의 첫 RED exit1(11 PASS/1 FAIL) → 명시 `reviewed`를 요구한 수정 후 exit0(12 PASS/0 FAIL).
유효한 finding과 별도의 미완료 coverage를 함께 보존한다. [기존 2D 기록](../execution-q2d.json)의 11개 통과는 이전 후보에 한정하며 실제 플랫폼 workflow 활성·설치된 reference 전달은 여전히 미확인이다.

## 2E — SVG·hook 실패와 생성 품질

수정: `templates/hooks/regen-arch-svg.sh`, `templates/gen_arch_svg.py`.
회귀가 없으면 `tests/architecture-generator-test.sh`를 추가하고 quality CI에 연결한다.
인터페이스: 유효한 hook 입력·그림 source → 유효한 XML·충돌 판정·파일 생성 결과.

- [x] malformed JSON, 정상 비적용 event, 정상 적용 event를 구별한다.
- [x] label 충돌 false를 실패로 전달하고 실패한 결과를 Written/PASS로 출력하지 않는다.
- [x] `API & DB`, 따옴표/각괄호 등 텍스트·속성 입력의 XML escape를 검증한다.
- [x] 임시 파일에서 XML parse·충돌·정상 출력과 원본 보존을 확인한다.
- [x] CI의 Ruff check/format 및 hook Bash/Python 구문 검사를 같은 설정으로 실행한다.

AC-Q5: invalid 입력/충돌에서 nonzero, 정상 출력은 parse 가능하고 generator 계약에 맞는다.

## 단계 완료

판정자 검출력·지원 환경·정상/실패/경계 결과를 기존 스펙에 연결한다.
동작 변경의 버전·직접 문서·테스트 계약을 함께 갱신하고 필수 FAIL/UNVERIFIED는 다음 단계로 숨기지 않는다.
새 실제 PR·CI의 검증은 마지막 delivery 단계에서 현재 후보로 별도 관찰한다.

2E [실행 증거](../execution-q2e.json): 5개 실제 생성기 반례/정상 시험·구문·Ruff 0.15.15 lint/format 통과. 통합 CI·독립 검토는 남는다.

2C [실행 증거](../execution-q2c.json): Alembic 16·count 변이 10·new-repo 13 통과. 강제 실패/0개 실행은 count gate의 한계로 보존했으며 production quality 전체 검사는 남는다.

2A [이전 후보 실행 증거](../execution-q2a.json): merge 55 PASS와 리뷰 helper/실제 skill 연결 37개 행동 사례 통과. 당시 fallback 결과를 새 자동머지 허용 근거로 옮기지 않으며 현재 수정 결과는 위 추가 기록을 따른다.
2B [실행 증거](../execution-q2b.json): solo 65 PASS·실제 hotfix skill 태그 블록 6 PASS. 원격 쓰기 없이 정책·후보·ref 효과를 확인했다.
