# 단계 1 — 안전 검사와 검증 후보

선행: [계획의 범위·현재 원본](README.md). 근거: [S01–S08·S11–S14](../review/01-safety-runtime.md).
진행 상태: 승인 범위의 반례·직접 소비자·독립 최종 검토와 main PR #507의 현재 required CI를 통과해 v0.82.0으로 발행했다. 소스·실제 설치의 후보 연결은 [전달 기록](../execution-delivery.json)을 따른다.

## 1A — 조회 실패 전에 보호 변경 차단

수정: `plugins/harness-guard/scripts/set-branch-protection.sh`, `tests/set-branch-protection-test.sh`.
현재 안내: `docs/code-review.md`, `docs/harness-maintenance.md`의 관련 부분만 함께 정렬한다.
인터페이스: check-runs 조회 결과 → 검증된 context 집합 → 보호 변경 요청.

- [x] fake gh의 조회 실패·malformed 응답·명시적 빈 목록·정상 목록을 준비한다.
- [x] 조회 실패 반례가 원본에서 보호 변경 요청을 만드는 것을 회귀가 잡는지 확인한다.
- [x] 전체 사전 조회/검증을 통과한 경우만 변경 요청을 보내도록 고친다.
- [x] 정상 main/develop, 정확한 context 집합, 명시적 승인 수/설정 보존을 확인한다.
- [x] `bash tests/set-branch-protection-test.sh`와 관련 구문 검사를 실행한다.

수용 기준 AC-S1: 조회 실패/잘못된 응답에서 쓰기 요청 0, nonzero와 명확한 실패 사유.
빈 집합은 허용하지 않는다. 첫 CI/명시한 필수 context로 준비한 뒤 재실행한다. 조회 실패를 빈 집합으로 변환하지 않는다.
실제 GitHub 보호 변경을 이 회귀 시험에 사용하지 않는다.

## 1B — 전송·파괴 명령의 표현 차이

수정: `plugins/harness-guard/scripts/codex-secret-egress-guard.mjs`, `guard.sh`, `lib/tokenize.sh`.
시험: `tests/codex-secret-egress-guard-test.sh`, `tests/guard-test.sh`, `tests/guard-tokenizer-test.sh`, `tests/guard-matrix-test.sh`.
인터페이스: tool command 입력 → 허용/거부 분류·종료값·비밀 없는 차단 로그.

- [x] curl URL-query/file form, wget body-file, 절대 경로 git/rm의 원래 누락을 fixture로 고정한다.
- [x] 옵션 분리/결합·quoted 공백·알려진 command 경로를 지원 범위에 맞게 확인한다.
- [x] README 파일 전송·일반 조회·파괴적이지 않은 git/rm을 정상 대조군으로 둔다.
- [x] 기존 tokenizer와 파일 판정 경계를 최소 수정하고 해당 네 시험을 실행한다.
- [x] 로그에는 합성 비밀 값이 남지 않고 거부 이유만 보이는지 확인한다.

AC-S2: 확인된 위험 입력은 exit 2, 허용 대조군은 exit 0. 네트워크 전송·reset·삭제 자체는 실행하지 않는다.
이 검사는 명령 분류 범위다. 모든 셸 표현·우회를 차단했다고 확대하지 않는다.

2026-10-09 추가 독립 리뷰: curl form의 `type`·`filename`·`encoder`·`headers` 속성과 여러 `@` 파일에서 민감 파일 참조를 놓쳤다.
[추가 수정 기록](../execution-integrated-review.json)의 첫 RED는 exit1(245 PASS/14 FAIL)이며, 수정 후 egress 273·guard 168·matrix 112·tokenizer 32 PASS와 pretool 연결·구문 검사는 exit0이다.
공개 데이터·literal `--form-string` 대조군과 셸 확장 위치를 보존했다. 실제 전송·비밀 파일 읽기·인증·Claude 추론·설치·원격 CI·최종 독립 재검토는 이 결과에 포함하지 않는다.

## 1C — 유효한 마이그레이션 구문의 누락

수정: `scripts/check-alembic-destructive-ddl.mjs`, `check-activerecord-destructive-ddl.mjs`, `check-destructive-ddl.mjs`.
시험: `tests/alembic-destructive-ddl-test.sh`, `tests/activerecord-destructive-ddl-test.sh`, `tests/destructive-ddl-test.sh`와 관련 fixtures.
인터페이스: 지원 scan root의 migration source → 파괴 동작·승인 marker 판정.

- [x] Python 한 줄 upgrade, Ruby 탭 호출, SQL COLUMN 생략, ORM MySQL 실행 주석을 추가한다.
- [x] Python/Ruby 입력은 실제 언어 구문으로, SQL은 공식 지원 문법으로 유효성을 확인한다.
- [x] scan root 밖 SKIP과 root 안 위험 입력을 구별하고 기존 첫 probe 실패를 보존한다.
- [x] 실행 주석·일반 주석·문자열·허용 DDL·정상 승인 marker를 서로 대조한다.
- [x] 세 시험과 `bash tests/migration-safety-test.sh`를 실행한다.

AC-S3: 누락 반례는 같은 경로에서 nonzero, 정상/허용 입력은 기존 계약 유지.
동적 SQL/helper를 완전히 해석하는 새 runtime은 만들지 않는다. 운영 DB 실행은 없다.

## 1D — native pilot의 실행 파일·원본·출력 연결

수정: `scripts/run-codex-native-loader-pilot.mjs`, `scripts/codex-fresh-session-smoke.sh`와 실제 verified runner 호출부.
시험: `tests/codex-native-loader-pilot-test.sh`, `tests/codex-native-loader-report-test.sh`, `tests/codex-fresh-session-smoke-test.sh`.
참조: 기존 split runner의 materialize·환경 정리 계약을 재사용하고 새로운 검증 프레임워크를 만들지 않는다.
인터페이스: 승인 revision/실행 파일 → 고정된 검사 source·허용 환경 → 독점 생성 report.

- [ ] smoke 호출 직전 바이너리 정체성 변경을 잡는 무해한 가짜 실행 파일 시험을 추가한다.
- [ ] Git clean/status와 실제 읽는 바이트가 다른 경우를 임시 repo에서 구성한다.
- [ ] 검증된 후보를 독립 materialize하고 영향받는 GIT_* 환경을 정리한다.
- [ ] report의 원본 내부 경로·기존 파일·symlink·동시 생성을 거부한다.
- [ ] 최종 출력 쓰기까지 포함해 원본 보존을 판정하고 위 세 시험을 실행한다.

AC-S4: 변경 바이너리/원본 불일치/위험 출력 대상은 실패, 원본 파일 수정 0, 정상 후보 report는 실행 증거와 일치.
기존 digest/CDHash·권한·credential 제한은 보존한다. 결과 JSON의 PASS 필드만으로 판정하지 않는다.

## 1E — profile 경로 quoting와 cache patch

수정: `scripts/manage-profile.mjs`, `scripts/profile-doctor.mjs`; 시험 `tests/profile-lifecycle-test.sh`.
대상 경로: 일반·공백·큰따옴표·달러/backtick 문자가 있는 임시 디렉터리.
AC-S5: JSON 유효성뿐 아니라 허용된 hook 명령이 의도한 파일을 실행하고 경로 문자를 그대로 보존한다.

- [x] 현재 경로 반례·정상 경로를 먼저 고정하고 shell quoting 및 doctor 관찰 경계를 보완한다.
- [x] doctor가 command 문자열 존재만으로 실행 가능하다고 판단하지 않는지 확인한다.
- [ ] 외부 cache patch S08은 단계 3의 공식 경로 대체와 함께 처리한다.
- [ ] 대체 전에도 quoting 결함이 실행될 수 있다면 patch·launcher 직접 호출부를 임시로 안전하게 고친다.
- [ ] 해당 경우 `tests/patch-codex-security-guidance-test.sh`, `tests/codex-hardened-launcher-test.sh`도 실행한다.

실제 외부 plugin cache를 수정하는 시험은 금지한다. 제거로 해결하면 남는 caller·CI·안내까지 대조한다.

## 단계 완료와 인계

각 묶음은 원래 반례 RED·수정 후보의 기대 결과·정상 대조군을 기록하고 영향 문서를 같은 변경에서 갱신한다.
고위험 후보는 구현자와 다른 읽기 전용 인스턴스가 원래 요구·현재 diff·원시 결과로 반증한다.
필수 실패/미확인, 보안 gate 약화, 승인 밖 원본/사용자 자료 변경이 남으면 이 단계 완료를 선언하지 않는다.
plugin 동작이 바뀌는 묶음은 두 manifest·README 버전과 현재 maintenance 계약을 함께 맞춘다.

1A의 원래 RED·수정 결과·권한 실행 증거: [실행 기록](../execution-s1a.json). 정상 자동 감지 대조군을 포함한 당시 영향 검사 62 PASS / 0 FAIL. 후속 독립 검토·현재 CI·v0.82.0 발행은 위 진행 상태와 전달 기록에서 확인한다.

1B [543개 단언](../execution-s1b.json), 1C [58개 구문 반례와 영향 시험](../execution-s1c.json), 1E [74개 수명주기 시험](../execution-s1e.json)은 각 기록에 묶인 이전 후보의 결과다. 새 1B 결과는 위 추가 수정 기록을 따른다.
1D의 격리 후보·출력 경계 결과는 [당시 실행 기록](../execution-s1d.json), 1E의 cache 축소·남은 선택형 patcher quoting 결과는 [3E 실행 기록](../execution-m3e.json)에 연결한다. 실제 native 세션·설치나 전체 단계 완료로 옮기지 않는다.
