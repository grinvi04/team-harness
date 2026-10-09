# v0.80.0 PR·CI·릴리즈 준비 기록

[상위 문서](qa-command-binding-validation.md)로 돌아간다. 아래는 원문의 해당 주제·당시 후보 기록을 순서대로 보존한 본문이다.

## PR 준비와 전달 상태 (2026-10-01)

사용자가 PR 준비 진행을 승인했다. 9월 29일의 구현·평가 범위와 별도로 이번 단계는
`fix/qa-scope-contract` → `develop` PR 생성이며, 소비 프로젝트 수정·릴리즈·전역 설치는 수행하지 않는다.
스킬 소스 후보는 위 최종 평가와 동일하며 PR 준비 시작 기준은 `1447daf`다. 이후 전달 상태 문서만 갱신한다.
PR 준비 시작 후보 `1447daf3543fdfee1cbbc4de251f8b1714743b31`에서 `.github/workflows/ci-gate.yml`의
quality 명령 63단계를 macOS 로컬에서 새로 실행해 **63/63, 모두 exit 0**을 확인했다. GitHub event 입력은
`--record docs/specs/qa-command-binding-validation.md`로 대체했고 ruff는 기존 0.15.15 바이너리를 사용했다.
새 모델 평가를 반복한 것은 아니다. 검사 시작 때 기록한 추적 파일 해시와 대조한 후속 변경은 이 전달 기록과
초기 범위 문서의 최신 후속 링크뿐이다. 이 문서 변경에는 동기화 선언·참조·diff 검사를 별도로 적용한다.

`gitleaks git . --log-opts='origin/develop..HEAD' --redact`는 기존 20커밋에서 검출 0건으로 종료했다.
독립 읽기 전용 검토는 PR 전체의 관련 문서 범위와 계약·판정자를 대조했고 초기 스펙의 과거 후보 표현과
준비 기준 표현을 바로잡았다. 그 밖의 근거 있는 차단 이슈는 발견하지 못했다. PR 본문의 동기화 선언은
이전 기록을 합친 관련 문서 32개를 포함하며, 로컬 참조 경로 119개가 존재함을 확인했다.

로컬 PR 준비 검증과 PR 생성은 완료했다. 생성 당시 결과와 후속 게이트는 아래에 구분하며,
전달 단계의 최신 상태는 PR 원본을 따른다. 로컬 검사 통과를 원격 CI·병합·릴리즈·설치 완료로 세지 않는다.


### PR 사전 검사에서 발견한 문서 크기 결함

첫 wrapper 호출은 push 전에 `qa-practical-evidence.json`(1,507,144 bytes)이 HEAD와 다르다고 거부했다.
실제 파일은 커밋과 같았으며 Git 출력 수집의 기본 1 MiB 버퍼가 원인이었다. 기존 quality 63단계 통과와
이 최초 wrapper 실패를 별도로 보존한다. 검사 대상에서 증거를 빼지 않고 출력 버퍼를 이미 읽은 파일
바이트 길이에 맞췄다. 이 전달 검사 수정으로 소스 버전은 **0.80.0**이 되며, 0.79.0 스킬 행동 평가의
source 본문은 바뀌지 않는다. 그 결과를 새 검사기 변경의 증거로 대신하지 않는다.

수용 기준: 1 MiB보다 큰 동일 문서·근거는 `--committed`에서도 PASS, 같은 길이·작은·큰 변경은
COMMITTED 실패 유지, 기존 누락·미추적·경로·상태 거부 유지, 실제 PR 본문의 선언 전체 검사 통과.
새 회귀는 수정 전 기존 24 PASS/새 1 FAIL로 원래 증상을 재현했다. 수정 후 검증과 PR 결과는 이어 기록한다.


수정 후 `node --test tests/document-sync-test.mjs`는 **25/25 PASS**였고 독립 검토도 실제 변경 거부가
유지됨을 확인했다. 코드 후보 `f99bd48`과 생성 CHANGELOG를 포함한 `868dbbc`에서 quality 63단계를
다시 실행해 **63/63, 모두 exit 0**을 확인했다. 시작 당시의 파일 해시와 완료 시점 원본은 초기 스펙의
과거 후보 표현 한 줄 외에 일치했다. 기존 0.79.0 검사 결과로 새 수정 검사를 대신하지 않았다.
실제 PR 본문 32개 문서의 `--committed` 검사도 통과했다. 이후 전달 기록 수정은 문서 검사로 대조한다.


### PR 생성 완료

2026-10-01 공식 `pr-create.sh` 래퍼로 [PR #480](https://github.com/grinvi04/team-harness/pull/480)을
생성했다(`fix/qa-scope-contract` → `develop`, 생성 시 head `00768a6`). 최초 실패 이후 대상 선언을
그대로 유지하고 큰 파일 검사 수정과 quality 재검증을 거쳤다. 생성 시 원격 CI는 대기/실행 중이었다.
이 절은 생성 당시 상태를 보존하며, 후속 커밋·CI·리뷰·병합의 최신 상태는 PR 원본에서 확인한다.
PR 생성 단계에서는 병합·릴리즈·전역 설치·소비 프로젝트 반영을 수행하지 않았다.
후속 단계의 판정과 다음 행동은 아래 전달 게이트를 따른다.


### CI·리뷰 판정과 전달 게이트

2026-10-01 사용자의 후속 진행 요청에 따라 PR #480의 게이트를 확인했다. 당시 head
`caf8ec6f6f26a455ac7b3c731049c616f51c3b48`는 로컬·원격과 일치했고 필수 검사
`quality`, `secret-scan`, `test-guard`, `atomic-trust-macos`, `commitlint-trusted`가 모두 통과했다.
[해당 CI 실행](https://github.com/grinvi04/team-harness/actions/runs/36740583418)에 결과가 보존돼 있다.
리뷰 스레드는 전체 조회에서 0건, 외부 commit status도 0개였다. `develop`의 현재 보호 정책은
위 필수 CI와 대화 해결을 강제하고 사람 승인 요건은 없었으며, 병합 가능 상태도 확인했다.

Codex native wrapper에 따라 앞서 수행한 독립 검토와 현재 후보를 대조했다. 검토한 코드 후보
`f99bd48` 이후에는 생성 CHANGELOG와 전달 문서만 바뀌었고, 큰 파일 수정과 QA 계약의 검토 결과는
유효하다. Claude 전용 리뷰를 실행한 것으로 보고하지 않는다. 이번 변경은 게이트 기록·안내 문서이며,
문서 현행화 뒤의 PR head에는 원격 필수 CI와 스레드·commit-status·병합 가능 여부를 다시 적용한다.

최신 head·검사·리뷰·병합 여부 및 병합 commit의 정본은 [PR #480](https://github.com/grinvi04/team-harness/pull/480)이다.
위 PASS는 명시한 후보의 기록이며 후속 head까지 자동 승계하지 않는다. PR이 열려 있으면 최신 후보의
게이트 통과 후 `pr-merge.sh`로 develop에 통합한다. 병합됐으면 다음 단계는 **0.80.0 릴리즈 검증**이며,
실제 태그·릴리즈·전역 설치·샘플 재검증은 각 단계의 실행 증거가 있어야 완료다. 소비 프로젝트 수정·배포는 계속 보류한다.


### 0.80.0 릴리즈 사전 검증 (2026-10-01)

**판정: release-check GO — 아래 검증 후보에서 정식 릴리즈 절차 진행 가능.**
대상은 병합된 `develop` 후보 `3c5b4b39a99baf42d79268788faae1d0f9f4b780`, 비교 기준은 이전 정식
태그 `v0.75.0`이다. 최신 `origin/develop`과 일치하고 작업트리가 깨끗한 상태에서 검증했다.
다른 작업트리가 사용하는 develop 브랜치를 이동하지 않고 이 체크아웃에서 동일 커밋을 검증했다.

| 항목 | 판정 | 실행·근거와 한계 |
|---|---|---|
| A 품질 | PASS | `.github/workflows/ci-gate.yml` quality의 63개 run 단계 전부 1회 실행, 63/63 exit 0. macOS 로컬에서 GitHub event 대신 이 기록을 `--record`로 사용하고 기존 Ruff 0.15.15를 확인해 같은 검사를 실행했다. 원격 Ubuntu 재실행을 뜻하지 않는다. |
| B 보안 | PASS | 별도 읽기 전용 검토에서 변경된 검사기의 인자 전달·경로·바이트 비교·실패 차단과 fixture 실제 거부 경로를 확인했다. `gitleaks git . --log-opts='v0.75.0..3c5b4b39a99baf42d79268788faae1d0f9f4b780' --redact --no-banner` exit 0, 26커밋 검출 0건. 지정 변경 범위에서 확인된 보안 결함이 없다는 판정이다. |
| C 마이그레이션·DB 표준 | 적용성 확인 PASS / 제품 DB 검사 SKIP | 제품 DB·적용된 마이그레이션·신규 엔티티가 없다. 변경 파일·추적 경로를 확인했고 `node scripts/check-migration-safety.mjs`도 exit 0과 Flyway 파일 없음 SKIP을 반환했다. 기존 적용본 수정·undo·소프트/하드 삭제·금액 컬럼 검사는 비적용이다. 템플릿·검사기 시험과 소비 제품 DB 검증을 혼동하지 않는다. |
| D 외부 파일럿 원본 | PASS | `node scripts/check-external-pilot-provenance.mjs --manifest docs/pilots/external-pilot-provenance.json`을 `--offline` 없이 실행, exit 0. 고정 GitHub 커밋 원본과 로컬 근거 7개를 대조했다. |
| 릴리즈 묶음 | PASS | `node scripts/build-release-bundle.mjs --output /tmp/harness-release080-bundle-20261001` exit 0. 같은 폴더의 `shasum -a 256 -c SHA256SUMS` exit 0, 73개 일치. manifest의 version=0.80.0과 sourceCommit이 검증 후보와 일치했다. |

품질 검증 시작·종료 시 추적 파일 722개의 SHA-256이 모두 같았다. 배포 환경변수 이름 대조는 제품
서버·프론트 런타임이 없어 비적용이다. 새 환경변수 참조는 시험 fixture의 npm 실행 확인뿐이며,
`docs/gen_arch_svg.py`도 없어 해당 SVG 신선도 검사는 비적용이다. 이를 실행 실패의 SKIP 전환으로 세지 않는다.

릴리즈 묶음 manifest SHA-256은 `7f14db62f767cdf15d7cc777d79a58761ce684a320ae858ef842e66728ec4d19`,
소스 tar SHA-256은 `132397e21a6ea01bf484a95e29b5cd30bf3b01814a03b39160784dd2e61b8fb9`다.
분리 package의 `installable: false`는 그대로이며 marketplace 승격·설치 완료를 뜻하지 않는다.
actor가 쓰는 trace와 판정자의 PASS만으로 실행 provenance를 증명하지 않는다는 기존 평가 한계도 유지한다.

이 결과를 기록하는 후속 변경은 이 문서와 제품 로드맵뿐이다. **다음 단계는 정식 0.80.0 릴리즈**이며,
릴리즈 브랜치에 이 결과 기록을 함께 반영하고 그 후보의 문서·CI 게이트를 확인한다. 최종 커밋이 달라지면
묶음·checksum을 그 커밋으로 다시 만들고, 코드가 달라지면 영향받은 검증도 다시 수행한다.
main 통합·태그 발행·역병합·전역 설치·샘플 설치 검증은 아직 수행하지 않았다. 소비 프로젝트 수정·배포는 보류한다.


### 0.80.0 정식 릴리즈 진행 (2026-10-01)

사용자의 정식 릴리즈 진행 요청에 따라 `3c5b4b3`과 사전 검증 기록 커밋 `2655dbe`에서
`release/v0.80.0`을 생성했다. 코드·스킬·버전은 사전 검증 후보와 같고 이후 변경은 진행 문서뿐이다.
두 plugin manifest·README·소개 페이지의 0.80.0을 유지하며 CHANGELOG 생성 결과를 다시 대조한다.
제품 서버가 없는 개발 기반 저장소이므로 staging/production HTTP 헬스체크는 비적용이다.
패키지 묶음·checksum과 GitHub 필수 CI를 릴리즈 후보 검증으로 사용한다.

[main 릴리즈 PR #481](https://github.com/grinvi04/team-harness/pull/481)을 생성했다.
2026-10-01 당시 후보 CI·리뷰가 진행 단계였다. main 보호는 사람 승인 1명과 stale 승인 무효화,
필수 검사 5개 및 대화 해결을 요구한다. AI 검토나 사용자의 작업 진행 요청을 GitHub 사람 승인으로
대체하지 않는다. 최신 head·CI·리뷰 상태는 PR 원본에서 확인한다.
당시 태그 발행·main 통합·develop 역병합은 대기였다. 이후 진행은 아래 2026-10-03 기록을 따른다.
설치와 소비 프로젝트 수정·배포는 포함하지 않는다.


PR #481의 `a6729654f478eeb09a79352df3a9a31bbc5c995d`에서 릴리즈 묶음을 다시 생성했다
(`node scripts/build-release-bundle.mjs --output /tmp/harness-release080-final-a672965`, exit 0).
첫 checksum 명령은 저장소 디렉터리에서 상대 경로 목록을 읽어 73개 파일을 찾지 못하고 exit 1이었다.
묶음 디렉터리를 작업 디렉터리로 지정한 `shasum -a 256 -c SHA256SUMS`는 exit 0, 73/73 일치였다.
이는 산출물 수정 없이 실행 위치를 바로잡은 결과이며 최초 실패를 제외한 무조건 1회 통과로 기록하지 않는다.

2026-10-01 당시 승인 대기는 실제 구성상 차단 조건이었다. GitHub 협업자 조회 결과는 작성자 `grinvi04` 한 명이며,
PR 상태는 `REVIEW_REQUIRED`, 리뷰 0건이었다. 미해결 스레드 0건·외부 commit status 0개도 확인했다.
최신 후보의 필수 CI 결과는 PR checks를 정본으로 확인한다. 당시 다음 진행에는 다른 사람의 GitHub 승인 또는
승인 요건의 일시 해제·원상복구를 수반하는 솔로 머지 방식의 명시적 선택이 필요했다. 당시 보호 설정은 변경하지 않았다.

독립 읽기 전용 검토자는 `3c5b4b3..a672965`의 두 문서 변경과 원본 품질 기록·후보·묶음을 대조했고
근거 있는 결함을 발견하지 못했다. 원격 GitHub gate는 주 작업자가 별도로 확인한다.
