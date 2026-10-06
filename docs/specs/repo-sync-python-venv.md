# Python venv 탐색 경계와 소비 repo 자산 점검

## 범위·판정

2026-10-06, 기준 develop `79fd3e2c98a950b9052d7e22e8c962748af5f80c`.
판정은 **소유**: 표준 자산 검사기의 소스/생성 의존 데이터 구분은 Harness의 책임이다.
Python 환경 생성·interpreter 수명주기는 도구에 위임한다. 소비 repo 수정·배포는 계속 보류한다.
정적 드리프트 점검을 제품 QA 실행이나 branch protection 강제의 증거로 확대하지 않는다.

## 요구·필수 QA 범위

| 요구·위험 | 조건·행동 | 독립 기대 결과 | 관찰 방법 |
|---|---|---|---|
| 생성 환경으로 검사 중단·스택 오탐 | 실제 venv 디렉터리, 일반 pyvenv.cfg, 외부 interpreter 링크와 Next.js 의존 신호 | exit 0, 원래 java/flyway만 감지 | 실제 checker + 격리 fixture |
| 이름만으로 실제 소스 누락 | cfg 없는 venv에 Next.js package.json | typescript/nextjs 감지 유지 | 같은 checker 출력 |
| 제외 조건으로 외부 탐색 우회 | venv directory symlink 또는 외부 cfg symlink | exit 1 유지 | 거부 fixture |
| 기존 경계 회귀 | 깊은 Flyway, 내부 일반 파일 링크, 외부·dangling·FIFO 링크 등 기존 사례 | 기존 허용·거부 결과 유지 | repo-sync 전체 시나리오 |
| 직접 소비자에서 원래 중단 해소 | 네 repo 읽기 전용 재실행 | 네 자산 보고서 생성; webhook은 python/alembic 감지 | 실제 repo별 stdout·exit code |
| 파일럿 환경 복사 경쟁 | 임시 Git fixture의 실제 자동 repack과 복사/정리 경계 | 자동 정리 유지·동기 완료 후 복사, 기존 신뢰 거부 검사 유지 | 실제 Git trace2와 loader pilot 회귀 |
| 공통 배포 자산 정합성 | 버전·문서·구문·전체 품질 검사 | 정본 CI quality와 독립 검토 통과 | 현재 후보 검사·PR CI |

위 항목은 모두 필수다. 제품 UI/DB/성능 시험은 검사기 변경에 비적용이며 소비 제품의 품질을 판정하지 않는다.
기존 `.venv` 고정 제외는 유지한다. `venv` 조건은 환경 내용이 안전하다는 인증이 아니며,
일반 cfg marker를 가진 생성 디렉터리 안을 소스 범위로 삼지 않는 명시적 분류다.

## 재현·수정 결과

최초 webhook 점검은 `venv/bin/python`의 외부 target 때문에 exit 1, 요약 생성 전에 중단했다.
이 최초 결과는 자산 드리프트 판정이 아니라 **UNVERIFIED**다.
`bash tests/repo-sync-test.sh` RED는 PASS 39 / FAIL 1이며 생성 venv 사례만 실패했다.
외부 interpreter fixture를 둔 실제 checker가 실패하므로 단순 소스 텍스트 비교가 아니다.
최소 수정 뒤 같은 명령은 PASS 40 / FAIL 0, `node --check`도 exit 0이었다.
실행 환경은 macOS, Node v22.18.0이다. 로그는 작업 호스트의 임시 경로에 있으며 이 문서는 실행 요약이다.

네 소비자 재실행의 원문 출력·명령·작업 디렉터리·checker digest·소비 HEAD/status는
[정규화 결과](../pilots/consumer-repo-sync-2026-10-06.json)에 보존한다. 개인 경로는 `<USER_HOME>`이다.
checker digest는 해당 실행 당시 미커밋 수정 파일에 대응한다. 이후 동일 digest를 후보와 대조한다.

| repo | OK | WARN | MISSING | 실행 / 의미 |
|---|---:|---:|---:|---|
| erp | 16 | 1 | 4 | exit 1, 커밋 강제 체인 드리프트·Next.js rule 경고 |
| siku | 5 | 0 | 11 | exit 1, pointer·커밋 체인·공통 DDL bundle 드리프트 |
| webhook-service | 7 | 0 | 11 | exit 1, 탐색 중단 해소·pointer/커밋/DDL 드리프트 |
| DriveTree | 15 | 0 | 3 | exit 1, 커밋 workflow/config/validator 드리프트 |

MISSING은 checker의 필수 표준 미충족 분류다. 특히 커밋 체인은 정본 digest 불일치도 포함하므로
파일 자체의 부재와 동일하지 않다. 다른 언어의 DDL 검사도 현행 공통 bundle 계약에 따라 포함된다.
네 repo의 drift-free 기준은 **FAIL**이며 검사기 수정의 수용 기준인 보고 생성은 **PASS**다.
기존 역사적 zero-drift 기록을 덮어쓰지 않는다. 그 당시 후보와 지금 자산은 다르다.

## 원격 CI 최초 실패와 환경 보완

최초 원격 후보 `b2ec0dec7cb0b96f7c4225c12991686ed23fc316`의
[run 37450797111](https://github.com/grinvi04/team-harness/actions/runs/37450797111)은 quality **FAIL**이었다.
`codex-native-loader-pilot-test.sh`에서 임시 `.git/objects/*`를 cp 하던 중 경로가 사라지고
EXIT cleanup의 `.git` 제거도 실패했다. 가상환경 회귀는 이 run에서 통과했으며, 실패를 재시도 PASS로 덮지 않는다.

가설은 임시 fixture commit의 detached Git maintenance가 객체를 재배치하며 복사·삭제와 경쟁한다는 것이다.
격리 실행에서 `gc.auto=1`로 실제 repack을 유도했고 trace2에 commit이 `maintenance --detach`를
실행함을 확인했다. 새 동기 완료 판정은 수정 전 **FAIL**이었다. 최초 CI에는 Git trace가 없어
그 실행의 프로세스 identity까지 직접 확인한 것은 아니며, 증상·코드 경계·격리 재현에 기반한 원인 판정이다.

[Git 공식 maintenance 계약](https://git-scm.com/docs/git-maintenance#_configuration)에 따라 임시 source
repo에만 `maintenance.autoDetach=false`와 설정 fallback `gc.autoDetach=false`를 설정한다.
새 trace 판정은 `maintenance --no-detach`를 제공하는 현재 Git을 대상으로 하며,
`git gc --auto`만 제공하는 과거 실행 경로의 호환성 검증을 뜻하지 않는다.
`maintenance.auto=true`·강제 auto repack을 실제 수행하고 trace2로 foreground 실행과 repack 발생을
단언하므로 정리 기능을 꺼서 통과시키지 않는다. 기존 신뢰/서명/소스 승인/인증 격리 거부 시험도 유지한다.
전역·소비 repo 설정과 production runner는 수정하지 않는다. 보완 후 해당 전체 pilot은 exit 0이었다.

## 진행·다음 행동

소스 후보는 저장소 동작 변경 정책에 따라 0.81.0이다. 릴리즈·설치 완료를 뜻하지 않는다.
로컬 quality 63개 단계는 모두 exit 0이었다. 실행 중 보호 조회 결과의 문서만 추가했고 최종
`5f9b028eaa8dbd560201d8b69c1403f8b4bb4c2a`의 문서 동기화 단계도 다시 실행해 exit 0을 확인했다.
ruff 0.15.15는 임시 venv PATH로 제공해 CI의 pipx 설치만 대체했으며 실제 lint 명령은 동일하다.
같은 후보의 독립 검토는 finding 없음, 회귀 40/40·구문·diff·checker digest 대조를 직접 확인했다.
전체 gate를 verifier가 중복 실행한 것으로 기록하지 않는다. 이 문서의 결과 연결 후속은 docs-only다.
원격 CI·최종 독립 대조·develop 전달 상태는 [PR #485](https://github.com/grinvi04/team-harness/pull/485) 원본을 따른다.
소비 repo 후속은 별도 승인을 받은 뒤 정본 자산 변경 PR과 해당 제품의 QA 계약을 검토한다.
네 repo main/develop의 `set-branch-protection.sh <owner/repo> --check`는 모두 exit 0이었다.
승인 0명, enforce_admins=on이며 checks 수는 erp 8/8, siku 6/6, webhook 5/5, DriveTree 5/6이다.
기본 검사는 필수 check 존재·보호 속성을 확인하며 exact context 집합의 최신 표준 일치까지 증명하지 않는다.
제품 시험·소비 파일 수정·배포는 포함되지 않는다.

## 0.81.0 릴리즈 사전검증 — NO-GO

2026-10-06, develop 후보 `7cafd144a7e1c007930650d499bcfdf45bb1bde1`을 clean detached checkout에서
검증했다. 다른 worktree의 develop을 이동하지 않았으며 이 판정은 아래 후보와 범위에 한정한다.

| 항목 | 판정 | 현재 근거·한계 |
|---|---|---|
| A 품질 | PASS | 현재 CI quality의 63개 run 스텝을 macOS에서 전량 실행, 모두 exit 0; 앱 배포 env·SVG generator 신선도는 비적용 |
| B 보안 | **FAIL** | Medium 1건: 신뢰·서명 음성 시험이 실제 검증 전에 승인 인자 오류로 종료해도 통과 |
| C DB·마이그레이션 | SKIP / 표준 PASS | 실제 DB·운영 마이그레이션·엔티티 없음; migration checker exit 0은 명시적 Flyway skip |
| D 외부 파일럿 원본 | PASS | offline 없이 GitHub exact commit 원본의 7개 artifact 대조, exit 0 |
| 릴리즈 묶음 | PASS | 위 후보의 0.81.0 source/package bundle 생성·SHA256SUMS 전 항목 확인; split installable:false 유지 |

보안 finding은 [이슈 #486](https://github.com/grinvi04/team-harness/issues/486)의 정본으로 추적한다.
PATH-shadow 및 unsigned self-trust live 시험이 필수 `--approved-*`를 생략해 `parseArgs()`의 exit 2로 끝난다.
안내 오류에 두 시험의 digest/signature 검색 문구가 모두 있어 whole pilot exit 0을 해당 경계 검증으로
사용할 수 없다는 반례를 독립 검토자가 재현했다. v0.80.0부터 존재한 시험 결함이며 실제 서명 우회 취약점을
증명한 것은 아니다. venv 탐색 변경의 새 보안 결함은 해당 검토에서 발견하지 못했다.

명령·종료 코드·품질 원문·workflow·runner·bundle 지문·비적용 항목은
[사전검증 기록](../pilots/release-v0.81.0-check.json)에 보존한다. 개인 경로만 정규화했고 원본과 정규화본의
지문을 구분한다. 품질 원문은 현재 실행 결과이며, snapshot runner의 `<USER_HOME>`은 재실행 시 호스트
경로를 지정해야 한다. 로컬 임시 event는 기존 명세의 문서 선언을 연결했다. ruff bootstrap의 pipx 설치만
준비된 동일 버전 임시 venv로 대체했다. 운영 env·live DB·실제 서명 바이너리 양성·live egress 검증이나
현재 merge 후보의 Ubuntu 전량 실행을 수행한 것으로 확대하지 않는다.

종합 **NO-GO**: 보안 필수 FAIL이 남아 0.81.0 태그·정식 발행·전역 설치를 진행하지 않았다.
2026-10-07 후속 [#486 보완 명세](binary-trust-oracle.md)에서 실제 거부 시험·변이 검출·로컬 품질 63단계·
독립 보안 검토를 통과했다. 전달·최종 CI·병합은 [PR #488](https://github.com/grinvi04/team-harness/pull/488),
수정 후보의 최종 사전검증은 [이슈 #486](https://github.com/grinvi04/team-harness/issues/486) 원본에서 추적한다.
소비 repo 수정·배포와 split 전환 보류는 유지한다. 이 사전검증 기록 변경은 문서·증거만이며
원래 시험 결함을 구현에서 고쳤다는 뜻이 아니다. 기록 전달·병합 상태는 [PR #487](https://github.com/grinvi04/team-harness/pull/487) 원본에서 추적한다.

## 문서 동기화

```harness-doc-sync
{"version":1,"documents":[
 {"path":"docs/specs/repo-sync-python-venv.md","reason":"필수 범위·재현·결과·미해결 소비 drift"},
 {"path":"docs/pilots/consumer-repo-sync-2026-10-06.json","reason":"읽기 전용 원문과 후보 digest"},
 {"path":"docs/pilots/release-v0.81.0-check.json","reason":"릴리즈 사전검증 후보·원문·NO-GO 근거"},
 {"path":"docs/harness-maintenance.md","reason":"생성 venv 제외 조건과 기존 거부 경계"},
 {"path":"docs/product-direction.md","reason":"QA 후속 점검과 소비 수정 보류 상태"},
 {"path":"README.md","reason":"소스 후보 버전"},
 {"path":"docs/intro.html","reason":"소스 후보 버전"},
 {"path":"CHANGELOG.md","reason":"생성 변경 이력"}
],"items":[]}
```
