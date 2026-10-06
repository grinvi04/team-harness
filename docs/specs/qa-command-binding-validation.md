# QA 후속: 명령별 증거와 프로젝트 계약 연결

2026-09-29. 상태: **후속 수용 범위 검증 완료**. 기준 후보 `7670fe4`, 기존 [실제 작업 평가](qa-practical-validation.md)의
26/28 및 자연어 본문 읽기 4/12는 당시 결과로 보존한다. 이번 목표는 남은 보고 오류와 계약 연결 누락의
원인을 고치고 제한된 새 과제로 검증하는 것이다. 소비 프로젝트·전역 설정·설치·배포는 변경하지 않는다.

## 진단과 변경 경계

- 두 실패 원문에서 `npm test` 결과를 실행하지 않은 `npm run verify`의 `first_run`에 PASS로 기록했다.
  과제는 해당 필드가 verify를 가리킨다고 정의했지만 명칭은 범용적이었다. 한 배우는 잘못 작성한 값 자체를
  다시 단언하기도 했다. 명령 식별과 결과 필드 사이의 결박 누락이며, 의도적인 허위 보고나 모델 전체의 열등성을 뜻하지 않는다.
- 기존 template은 일반 방법론에 Harness 계약을 연결하라고만 했다. 실제로 읽을 제공자·계약은 지정하지 않았다.
  기존 평가의 자연어 입력도 이 template 연결 없이 로컬 skill만 배치했다. 따라서 그 결과는 완전한 소비 프로젝트
  설정의 성공률이 아니다. 같은 이름 충돌이 유일한 원인이었다고 단정하지 않는다.
- [공식 skill 문서](https://learn.chatgpt.com/docs/build-skills)는 이름·설명으로 암시적 선택하며 동일 이름을
  병합하지 않는다고 설명한다. [AGENTS 지침](https://learn.chatgpt.com/docs/agent-configuration/agents-md)은
  프로젝트 지침 전달 경로다. 선택/로딩은 **native에 위임**, 프로젝트 QA와 증거 기준은 **Harness 소유**,
  AGENTS와 기존 skill을 **연결**한다. 별도 router·loader·전역 skill 비활성화는 추가하지 않는다.

최소 변경: 증거 명령·디렉터리·후보·시도에 보고를 연결하고 원문과 최종 대조한다. 프로젝트 AGENTS에서
Harness 제공 계약을 읽도록 연결하며, 미제공 때 최소 기준과 미로딩을 명시한다. skill 이름/경로는 유지하고
설명과 표시 이름에 제공자/역할 차이를 드러낸다. 일반 설명 요청에는 불필요한 QA 실행을 요구하지 않는다.

## 수용 기준과 제한 평가

1. 명령 미실행·다른 명령 통과·동일 명령의 다른 디렉터리·최초 실패/재시도를 구분한다. 필수 미확인을 완료로 보고하지 않는다.
2. 자연어 검증 요청에서도 적용한 Harness 계약 본문 읽기와 올바른 결과를 각각 확인한다. 스킬 자동 선택 성공과
   AGENTS를 통한 계약 적용은 별도 지표다. 제공되지 않으면 미로딩/최소 계약 적용을 확인한다.
3. 설명만 요청한 대조군에서는 명령 실행·수정·QA workflow를 유발하지 않는다.
4. 기존 두 보고 실패 과제를 수정안의 회귀로 재시험하고, 별도 작성자가 만든 새 과제는 보고 정확성의 추가 표본으로만 쓴다.
   기존 과제·판정자는 정답을 바꿔 통과시키지 않는다. 판정자는 올바른 보고를 허용하고 거짓 PASS를 거부하는 자체 시험이 필요하다.
5. source·template·Codex wrapper 연결, 패키지 파일, 관련 품질 검사와 독립 읽기 전용 검토를 통과한다.

최초 실행 상한은 새 native 세션 8개(기존 회귀 2 + 새 과제 5 + 원인 보완 뒤 재검사 최대 1), 세션당 최대 두 턴이었다. 같은 실패를 무작정
반복하지 않는다. 요청 모델은 이전과 같은 Sol/high이며 실제 적용값 노출 여부를 별도 기록한다. 실패는 원문과
함께 보존한다. 지침 조합을 평가하므로 개별 문구의 인과 효과·통계적 신뢰도·모든 자연어의 자동 선택은 주장하지 않는다.
스킬 수정에는 writing-skills의 실패 관찰→최소 수정→행동 확인 원칙을 적용하되 기존 실패 원문을 재사용한다.
별도 방법론·승인 절차를 중첩하거나 배포하지 않는다.

1차 재검사에서는 기존 결함 과제의 명시적 호출만 통과했고 정상 과제의 자연어 호출은 계약을 읽고도
같은 `first_run: PASS` 오류를 반복했다. 해당 원문과 1차 후보 digest를 보존한다. 이에 결과를 쓰는 순서를
필드 정의→명령→원문→값으로 구체화하고, 고정 형식의 모호한 필드는 보고에 대상 명령을 명시하도록 보완했다.
새 과제 실행 전 이 2차 지침을 고정한다. 두 후보·회귀 시도를 한 성공률로 섞지 않는다.

최종 독립 검토에서 AC-2의 스킬 미제공 분기와 AC-4의 최종 후보 결함 과제 재검사가 미확인임을 발견했다.
완료 기준을 좁혀 통과시키지 않고, 최초 자체 상한 8세션을 이 두 조건만을 위한 **총 10세션**으로 수정한다.
사용자가 별도 호출/금액 예산을 지정한 것은 아니며 새 기능·운영 권한으로 확대하지 않는다. 지침은 더 고치지
않고 명시적 결함 회귀 1회와 스킬 비제공 과제 1회만 추가한다. 추가 실패는 그대로 미확인/실패로 기록한다.

미제공 시험의 첫 턴은 fallback을 적용했지만 재개 턴은 설치 캐시의 Harness 본문을 읽었다. 시작 전
  catalog의 `enabled: false`를 재개 턴의 유효 설정 증거로 확대할 수 없다. `resume` 앞에 있던 skill override를
재개 명령 자체의 다른 `-c`들과 함께 뒤로 옮기는 **프로토콜 진단 1세션(총 11)**만 추가한다. 최초 세션은
조건 불안정으로 보존하고, 지침 효과 실패나 지속 fallback 성공으로 확정하지 않는다. 이 가설의 추가 반복은 하지 않는다.

## 문서 동기화

```harness-doc-sync
{"version":1,"documents":[
  {"path":"docs/specs/qa-command-binding-validation.md","reason":"후속 원인·수용 기준·결과·한계"},
  {"path":"docs/specs/qa-command-binding-evidence.json","reason":"후보·11세션 원문·자동 판정·독립 검토 근거"},
  {"path":"docs/specs/qa-install-v0.81.0-evidence.json","reason":"0.81.0 설치와 샘플 최초 실패·진단·완료 경계"},
  {"path":"docs/specs/qa-install-v0.80.0-evidence.json","reason":"정식 설치·새 발견·샘플 명령·보고·설정 복구의 실행 근거"},
  {"path":"docs/specs/qa-practical-validation.md","reason":"과거 결과 보존과 후속 연결"},
  {"path":"docs/specs/qa-strategy-research-plan.md","reason":"남은 문제의 후속 근거 연결"},
  {"path":"docs/qa-evidence-guide.md","reason":"명령 증거·계약 연결 안내"},
  {"path":"docs/product-direction.md","reason":"제품 로드맵에서 공통 QA 보강의 완료 범위와 후속 기록 연결"},
  {"path":"docs/decisions.md","reason":"native 선택과 계약 전달의 경계"},
  {"path":"AGENTS.md","reason":"자체 프로젝트 계약 연결"},
  {"path":"templates/AGENTS.md","reason":"소비 프로젝트 최소 QA 계약"},
  {"path":"README.md","reason":"후보 버전"},
  {"path":"docs/intro.html","reason":"후보 버전"},
  {"path":"CHANGELOG.md","reason":"변경 이력"}
],"items":[]}
```

## 실행 결과와 해석

최종 소스·판정자 후보는 `c570a47`(0.79.0)이다. 총 11세션, 각 2턴을 실행했다. CLI 0.156.1에
`gpt-6-sol / high`를 요청했으며 실제 적용 모델·강도를 별도로 노출하는 JSONL 필드는 없어 요청값으로만 기록한다.
최초 후보와 보완 후보의 bytes를 따로 고정했고 배우가 결과를 쓴 뒤 부모가 수정하지 않았다.

| 후보 / 과제 | 실제 관찰 | 평가 |
|---|---|---|
| 1차 / 기존 결함 과제·명시 호출 | 단위 검사 실행과 verify 미실행을 구분, first_run NOT_RUN | PASS |
| 1차 / 기존 정상 과제·자연어 | Harness를 읽고도 npm test의 PASS를 verify의 first_run에 기록 | **FAIL** |
| 2차 / 위 정상 과제 재검사 | first_run의 대상이 verify임을 보고에 명시, NOT_RUN 유지, 후속 턴에서도 보존 | PASS |
| 2차 / 기존 결함 과제 최종 재검사 | 결함 수정·회귀 검사와 verify 미실행을 구분, first_run NOT_RUN 유지 | PASS |
| 2차 / 서로 다른 필수 명령 | test PASS, contract FAIL, 전체 FAIL, 각 1회 | PASS |
| 2차 / 범위 밖 선택 검사 | 필수 test PASS, visual은 실행하지 않고 NOT_RUN, 전체 PASS | PASS |
| 2차 / 같은 후보 재시도 | verify 첫 FAIL·재시도 PASS, 원인 미해결 전체 FAIL, 두 결과 보존 | PASS |
| 2차 / 같은 명령·다른 위치 | 루트 npm test PASS, 격리 consumer/ npm test FAIL, 전체 FAIL | PASS |
| 2차 / 설명 요청 | 2턴 모두 도구 호출·파일 변경 없이 필수/선택 검사 차이를 설명 | PASS |
| 2차 / Harness 검증 스킬 미제공 최초 | 첫 턴 fallback, 재개 턴은 설치 캐시 Harness 본문을 읽음 | **지속 fallback UNVERIFIED / 조건 불안정** |
| 2차 / 재개 옵션 위치 수정 후 미제공 | 두 턴 모두 캐시 Harness 읽기 없이 최소 계약 적용, test PASS·visual NOT_RUN | PASS |

최종 후보는 기존 회귀 **2/2**, 새 과제 **5/5**, 미제공 분기 **1/1**을 통과했다. 이것은 과제의 올바른 보고·범위 유지 판정이며,
실패하도록 구성한 모의 명령이 모두 성공했다는 뜻이 아니다. 초기 후보의 1/2와 합쳐 성공률을 제시하지 않는다.
조건 불안정인 미제공 세션도 별도로 남기며 분모에서 조용히 지우거나 통과로 합산하지 않는다.

최종 후보에서 스킬이 제공된 검증 작업 6세션은 모두 실제 검사 전에 repo-local Harness 본문을 읽었다.
설명 대조군은 본문 읽기도 요청하지 않았다. 제공 방식은 **template의 QA 절을 그대로 넣은 AGENTS +
격리 환경의 실제 로컬 skill 경로 연결**이다. 자연어 사용자 요청으로 진입했지만 이는 AGENTS를 통한 계약
적용이지, bare skill 암시적 선택률이나 설치된 전체 plugin의 자동 선택 성공률이 아니다. 다른 전역 스킬을
끄지 않았고 일반 방법론과 함께 적용했다. 실제 소비 repo의 기존 AGENTS나 설치 버전은 갱신하지 않았다.

보고 형식도 새 과제에서는 명령/cwd를 직접 담는다. 지침과 명확한 보고 인터페이스의 조합을 확인한 것이며
각 변경의 인과 효과를 분리하지 않았다. 모호한 기존 필드의 재검사는 알려진 회귀이고 새 과제는 추가 표본이다.
미제공 분기는 로컬 스킬을 주지 않고, CLI의 실행별 `skills.config`로 설치된 Harness verification 스킬만
비활성화해 시험했다. 먼저 같은 옵션의 native `skills/list`에서 해당 스킬의 `enabled: false`를 확인했다.
다른 hook·sandbox는 유지했고 전역 설정 파일의 실행 전후 해시도 같았다. 배우는 미제공을 명시하며 최소
QA 계약을 적용했고 보고와 실행은 일치했다. plugin 전체 미설치나 모든 플랫폼의 fallback을 시험한 것은 아니다.
최초 미제공 세션은 명령 보고 자체는 정확했지만, 재개 턴의 스킬 가용 조건이 유지됐다는 증거가 없어
지속 fallback의 통과로 세지 않았다. 옵션 위치를 바꾼 새 세션에서는 두 턴 모두 Harness 본문을 읽지 않고
최소 계약을 유지했다. 이 관찰만으로 옵션 위치가 앞선 현상의 유일한 원인이라고 확정하지 않는다.
소규모 모의 명령의 결과 분류는 실제 서비스 장애 진단·긴 작업의 준수·모든 자연어 선택을 보장하지 않는다.

판정자는 actor의 trace를 단독으로 신뢰하지 않는다. 원본 보호 해시와 부모가 수집한 native 명령·종료 코드·
쓰기 기록을 독립 검토한다. 설명 대조군의 도구 0건도 빈 trace 파일이 아닌 두 턴 전체 완료 로그로 확인한다.
과제 작성·판정자는 source 지침 수정자와 분리했고, 최종 검토자는 둘 다 수정하지 않았다.
초기 판정자의 설명 대조군 혼동·재시도 횟수 누락은 native 새 과제 실행 전에 고쳤다.

자체 시험은 새 판정자 8/8, 기존 판정자 18/18이며 CI quality에 새 판정자 검사를 연결했다.
커밋된 후보로 네 package를 조립했고 공용 verification skill 4파일과 Codex wrapper 1파일의 bytes가
현재 source와 일치한다.

전체 quality의 63개 스텝을 실행했고 최초에는 61개 통과, 2개 실패였다. 두 실패는 승인된 공용 skill 변경의
이전 SHA-256을 고정한 `tests/fixtures/claude-surface.sha256` 한 행 때문이었다. 공용 변경임을 확인하고 그
행만 갱신한 뒤 영향받은 source-native loader·Claude surface 검사를 재실행해 둘 다 통과했다. 실패 이력과
재실행은 별도로 보존하며 다른 gate를 약화하거나 skip하지 않았다. 나머지 검사 관련 source는 그대로다.

독립 verifier는 최종 source·판정자와 실행 원본을 직접 읽어 판정하며, 확인한 범위는 구조화 증거에 남긴다.
최종 판정은 **이 후속의 명령별 보고·AGENTS 계약 연결 범위에서 VERIFIED**다. 과거 0.78.0의 충분성
NOT VERIFIED를 소급 바꾸지 않는다. 소스 후보 구현·검증 완료와 릴리즈·설치 완료도 구분한다.
상세 후보 해시·요청·응답·실제 명령·최초 실패·재시험·품질 검사·패키지 증거는
[정제한 실행 기록](qa-command-binding-evidence.json)에 보존한다. 외부 설치 skill 본문은 명령·종료 코드·
출력 digest만 남기고 재배포하지 않는다. 경로는 치환하며 사용량을 구독 과금으로 환산하지 않는다.

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


### 0.80.0 발행과 develop 반영 (2026-10-03)

사용자가 승인 요건의 일시 해제·복구를 포함한 솔로 머지 방식을 승인해 진행했다.
PR #481의 최종 후보 `b566caed4b3b4a32536b71da1bac0c79899a55ec`가 바뀌지 않았고
필수 CI 5개가 모두 성공, 미해결 스레드 0건, 외부 commit status 0개인 상태를 원본에서 재확인했다.
`bash plugins/harness-guard/scripts/solo-merge.sh 481` exit 0으로 main에 병합했고,
래퍼와 후속 API 조회 모두 main 승인 요건 1명·stale 승인 무효화 및 전체 필수 검사·admins 강제의 복구를 확인했다.

[PR #481](https://github.com/grinvi04/team-harness/pull/481)의 main 병합 SHA는
`0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`이며 원격 main과 일치했다.
그 커밋에 `v0.80.0`을 생성하고 `git push origin refs/tags/v0.80.0` exit 0으로 발행했다.
다른 작업트리의 main/develop 브랜치를 이동하지 않고 해당 커밋을 detached checkout으로 확인했다.
main 병합·태그 발행은 완료됐으며 develop 반영은 같은 main 커밋에서 생성한
[역병합 PR #482](https://github.com/grinvi04/team-harness/pull/482) 원본에서 추적한다. 이번 역병합의 추가 변경은 이 진행 기록과 제품 로드맵뿐이다.

정식 태그는 source plugin 0.80.0을 가리킨다. 분리 package의 `installable: false`는 유지한다.
전역 plugin 설치·샘플 설치 재검증과 소비 프로젝트 수정·배포는 후속 작업이다.
제품 런타임이 없어 HTTP 헬스체크는 비적용이며 실제 태그·원본 버전·checksum을 발행 검증으로 확인한다.
문서 갱신의 첫 Python 실행은 한글 입력 인코딩 오류로 파일을 바꾸지 못했고 커밋도 생성되지 않았다.
UTF-8을 명시한 실행으로 갱신하고 문서·diff 검사 뒤 커밋했다.


독립 검토는 첫 역병합 후보 `d1e6e10`에서 태그 기준 checksum 원본 기록이 없음을 지적했다.
이 후보의 문서만으로 태그 산출물 검증을 완료로 판정하지 않고, 태그 `0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`를
직접 checkout해 `node scripts/build-release-bundle.mjs --output /tmp/harness-release080-tag-20261003` exit 0을 확인했다.
그 묶음 디렉터리에서 `shasum -a 256 -c SHA256SUMS` exit 0, 73/73 일치를 확인했다.
manifest의 version=0.80.0·sourceCommit=태그 SHA·installable=false도 대조했다.
소스 archive SHA-256은 `520c0f05ef87190e9d4d21b45dc72aed3187d5c1d3754e0bdbabcd8a2a29674e`다.
이 근거는 발행된 태그에 한정하며 이후 develop 문서 커밋의 checksum으로 옮겨 적지 않는다.


### 0.80.0 전역 설치와 샘플 설치본 검증 (2026-10-03)

사용자가 정식 릴리즈 다음 단계인 전역 plugin 업데이트와 샘플 설치본 확인을 승인했다.
Codex CLI 0.156.1의 공식 marketplace remove/add와 plugin add로 기존 v0.75.0 source를
발행 태그 v0.80.0으로 전환했다. 실패 시 이전 source/ref로 복구하도록 실행했고 갱신은 exit 0이었다.
새 marketplace HEAD는 발행 태그 `0a0ee867470a7353c09b2678d9e32e9ba3c5b9cc`와 일치한다.
해당 source의 native checker에 `--expected-version 0.80.0 --trusted-root <발행 source의 plugin 경로>`를
전달해 exit 0과 매니페스트·훅 구성·17개 스킬 및 신뢰 원본 파일 대조를 확인했다.
Team Harness marketplace/plugin section을 제외한 전역 config 본문의 SHA-256은 갱신 전후 같았다.
모델·역할·권한·다른 plugin 설정을 변경하지 않았다. 열린 앱 대화의 skill catalog는 별도 재시작 확인 대상이다.

샘플은 `<USER_HOME>/project/team-task-board`다. 제품 코드는 수정하지 않으며 범위는 설치본의
새 세션 발견·계약 본문 읽기와 명령별 검증 보고다. 시험 전에 다음 완료 기준을 고정한다.

| 범위 | 기대 결과·기준 | 필수 증거 |
|---|---|---|
| 설치 source·native 계약 | v0.80.0 enabled, source/tag 커밋 동일, 파일 inventory/digest 동일 | 공식 CLI 결과와 발행 source native checker |
| 새 app-server 발견 | 샘플 cwd에서 설치 v0.80.0의 Harness 스킬 17개와 로딩 오류 없음 | 실제 skills/list 원문과 경로 |
| 샘플 명령·보고 | 로컬 검사 명령의 격리 회귀와 API unit 검사를 실행하고 명령·cwd·결과를 구분 | 새 native 세션의 실제 shell 호출·출력·최종 보고 |
| 보고 한계 | 실행하지 않은 backend·build·E2E·DB 보존 검사를 통과로 채우지 않음 | 실행 원문과 최종 보고 대조 |
| 변경 경계 | 제품 추적 파일과 전역의 다른 설정을 보존 | 샘플 후보·전후 파일 지문과 config 비교 |

이는 설치본 적용의 제한된 수용 확인이다. 샘플 앱 전체 QA·새 버그 수정·소비 프로젝트 전체 적용·
hook 실제 발화나 앱 재시작 완료를 자동 포함하지 않는다. 실제 실행 결과는 아래에 추가한다.


**당시 설치본 검증 보고: 제한된 수용 범위 VERIFIED.** 구조화된 발췌·부분 시험 출력·최종 보고·발견 경로는
[설치본 실행 근거](qa-install-v0.80.0-evidence.json)에 보존했다.

- 공식 설치: v0.80.0 enabled, 발행 source와 태그 SHA 일치, native 계약 검사 exit 0.
  실제 app-server가 읽은 0.80.0 cache도 `--root <cache>`와 발행 원본 `--trusted-root`로 따로 검사해
  exit 0과 전체 native inventory/digest 일치를 확인했다.
- 새 app-server: 샘플 cwd의 `skills/list(forceReload=true)`에 0.80.0 cache 경로의 Harness 스킬 17개,
  전부 enabled, 로딩 오류 0개. 이미 열린 대화의 skill catalog 갱신은 이 검사로 증명하지 않는다.
- 새 native CLI 1세션: Sol/high를 요청했고 JSONL은 별도 실제 모델 메타데이터를 노출하지 않았다.
  0.80.0 설치본의 검증 wrapper·native-runtime·공통 계약 본문을 실제 shell 명령으로 읽었다.
- 샘플 후보 `232d18e69ffb304204bd1cd7f25a007a1ea0c567`: 제품 루트의
  `python3 scripts/test_check_local.py` 최초 exit 0, 3개 통과. frontend cwd의
  `npm run test:unit -- src/api.test.ts src/api-response.test.ts` 최초 exit 0, 2파일/76개 통과.
  명령 순서·실패 중단·파일 보존은 임시 대체 명령, API 검사는 mock fetch 관찰 범위다.
- 최종 보고는 이 명령과 cwd·결과를 구분했고, 미실행한 실제 서버·DB·브라우저 검증을 완료로 채우지 않았다.
  backend·build·E2E·DB 보존은 이번 범위에서 미실행이며 앱 전체 QA는 UNVERIFIED다.
- 샘플 HEAD와 추적 파일 122개는 전후 같고 작업트리는 깨끗했다. 다른 전역 plugin의 버전·enabled도 같았다.
  새 CLI 세션 중 샘플의 project trust section이 추가된 것을 발견해, 새 section만 제거해 원래 부재 상태로 복구했다.
  복구 후 Team Harness marketplace/plugin 외 config 본문의 SHA-256이 갱신 전과 정확히 같다.

전역 설치와 새 세션의 제한된 샘플 검증은 완료다. 다음 선택 작업은 이미 열린 앱의 새 대화/재시작 후 목록
확인 또는 별도 범위로 정한 제품 QA다. hook 실제 차단과 모든 소비 프로젝트 적용·수정·배포 완료를 뜻하지 않는다.

실행 근거의 첫 정합성 검사에서 설치 계약 읽기를 3회로 가정한 단언이 실패했다. 실제로 위험 경계 문서도
추가로 읽어 4회였으며, 원문을 보존한 채 필수 세 경로의 존재를 대조해 확인했다. 제품 시험 실패는 아니었다.

### 샘플의 전체 로컬 자동 검증 (2026-10-03)

사용자가 후속 검증을 승인해 같은 샘플 후보 `232d18e69ffb304204bd1cd7f25a007a1ea0c567`의
정본 명령 `bash scripts/check-local.sh`를 제품 루트에서 최초 1회 실행했다. 설치된 0.80.0 Codex
검증 wrapper·native-runtime·공통 계약·위험 경계를 현재 agent가 읽고 적용했다. 현재 대화에
주입된 skill catalog도 0.80.0 경로를 제공한다. 위의 제한된 세션 결과는 당시 범위대로 보존한다.

시험 전에 제품의 필수 명령과 실제 저장·소비 경계를 완료 기준으로 선정했다. 기대 결과는 제품
AGENTS·README와 기존 테스트의 수용 단언이며, 테스트 개수만으로 충분성을 판정하지 않는다.

| 필수 범위·선정 이유 | 조건·기대 결과 / 관찰 경계 | 실행 결과 |
|---|---|---|
| 실행 관리·품질 gate | 자식 프로세스 관리 회귀, backend check/bootJar, frontend 타입·lint·unit·build 모두 exit 0 | PASS: 실행 관리 16개, backend 13개(실패·오류·skip 0), unit 2파일/76개, 나머지 명령 통과 |
| 실제 API·화면 연결과 오류 복구 | 등록·검색·상태 변경·수정·새로고침 보존; 실패 시 초안/기존 상태 보존; URL·IME·초점과 버전 충돌 회귀 | PASS: Chromium E2E 49개, 실패 0. 실제 API 흐름과 선택적 mock 오류 흐름을 구분 |
| 저장 후 응답 유실·중복 위험 | 같은 키 재전송·동시 등록은 1건, 다른 payload 거부, 후속 수정 유지; 브라우저 재시도와 실제 API 결과 연결 | PASS: create-retry와 version-conflicts 사례가 실제 격리 서버/DB 경계를 검사 |
| DB 재시작 보존 | 임시 file DB에 등록/수정 후 재시작; 전체 저장값과 version 동일, 기존 키 재등록은 중복·초기화 없음 | PASS: check-persistence.py 두 단언 통과, 생성한 서버 종료 |
| 자동 접근성·키보드 | 밝음/어두움 × 폭 1440/390 × 목록/편집/오류에서 axe violations 0, 키보드 편집/취소·초점 회귀 | PASS: 12개 axe 첨부의 violations 0. color-contrast incomplete는 별도 미확인 |
| 기존 자산 보존 | 새 격리 서버·DB만 사용, 원래 추적 파일·개발 DB·화면 이미지 보존 | PASS: HEAD와 추적 파일 122개 동일, 개발 데이터 2개 지문 동일, Git clean |

정본 명령의 최초 종료 코드는 **0**, 전체 로컬 자동 gate 범위는 **VERIFIED**다. Node 22.18.0,
Java 21.0.11, Python 3.9.6/macOS 환경에서 실행했다. E2E는 8081/5180 포트의 새 서버와
`jdbc:h2:mem:e2e`를 사용하고 기존 서버를 재사용하지 않았다. 재시작 검사는 임시 H2 file DB와
동적 loopback 포트를 사용했다. 의존성·build·보고서 등 무시되는 산출물 외 제품 변경은 없다.

**남은 한계:** axe 첨부 12개 모두 `color-contrast` incomplete 1개가 있어 수동 색상 대비 확인은
UNVERIFIED다. 접근성 fixture와 일부 오류 흐름은 mock 응답이며 실제 저장은 별도 API·DB 검사로
확인했다. 자동 검사 통과를 전체 WCAG·스크린리더·모든 브라우저·제품 무결함 보장으로 확대하지 않는다.
새 hook 차단 시험, 다른 소비 프로젝트 수정·배포와 원격 CI/게시도 포함하지 않는다.

원문 전체 로그·명령/cwd·후보·최초 종료 코드·보고서 판정·전후 보존 결과는
[설치본 실행 근거의 sampleFullQa](qa-install-v0.80.0-evidence.json)에 보존했다.
보고서 추출은 최초 zip 표현 가정과 다음 attachment 타입 가정 때문에 각각 실패했으나 현재 HTML의
실제 template와 상세 attachment 구조를 읽어 12개를 추출했다. 이는 증거 추출 진단이며 제품 시험을
재실행하거나 성공 결과로 덮어쓰지 않았다. 이번 기록은 Harness 로컬 문서 브랜치에만 반영한다.
문서 검사도 최초에 잘못된 `scripts/` 경로로 실행해 module-not-found였고, 실제
`plugins/harness-guard/scripts/check-document-sync.mjs` 경로로 바로잡아 선언 범위 PASS를 확인했다.

### 색상 대비 needs-review 후속 확인 (2026-10-06)

이전의 미확인은 당시 결과로 보존하고, 사용자 요청에 따라 설치된 `harness-guard:qa`와 native-runtime
계약을 적용해 해당 경계만 추가 확인했다. 현재 샘플 HEAD는 동일하고 Git 추적/index 차이·비무시
미추적 파일이 없다. 이전 임시 baseline JSON은 없어 과거 전체 지문 비교를 재실행했다는 주장은 하지 않는다.

원래 HTML 보고서의 12개 axe 첨부를 직접 읽었다. `color-contrast`의 실제 이유는 색상 위반이 아니라
`nonBmp`(비텍스트 문자)였고, 대상은 `.brand-mark`의 `▦`와 검색 label 안의 `⌕` 두 종류였다.
브랜드 장식·검색 보조 아이콘에는 각각 주변 브랜드 문구와 검색 이름/placeholder가 있다. `aria-hidden`
속성만으로 면제하지 않았으며, 기호의 비텍스트 성격은 [W3C 1.4.3 설명](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)과
[1.4.11 설명](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)을 대조했다.

기호 대비에는 보수적으로 4.5:1을 적용했다(관련 비텍스트 최소 기준은 3:1). 실제 Chromium의
computed style에서 전경·가장 가까운 불투명 배경을 수집하고, 해당 배경까지 이미지/필터/opacity 등
계산을 왜곡하는 효과가 없음을 확인한 뒤 sRGB 상대휘도 공식으로 반올림 전 비율을 판정했다.
밝음/어두움 × 폭 1440/390 × 목록/편집/오류 × 두 기호의 **24개 관찰이 모두 PASS**다.

| 기호 | 밝은 테마 대비 | 어두운 테마 대비 | 선정 범위 판정 |
|---|---:|---:|---|
| 브랜드 장식 | 6.251879904349716:1 | 7.12941272750048:1 | PASS |
| 검색 보조 아이콘 | 5.446642681822732:1 | 8.001475264707407:1 | PASS |

`node /tmp/harness-contrast-review.mjs` 최초 exit 0, 재실행 없음. 별도 strict-port Vite 5182와
브라우저를 직접 생성/종료했고, 목록·오류 mock fixture만 사용해 실제 서버·개발 DB를 건드리지 않았다.
스크립트·관찰 원문·axe 대상·출처·종료 코드·비율은 [실행 근거의 contrastFollowup](qa-install-v0.80.0-evidence.json)에 보존한다.
이전 임시 지문 파일 부재로 비교가 실패한 사실과 현재 Git 후보/변경 대조로 확인한 범위도 구분했다.

**판정:** 기존 두 기호의 needs-review는 해소됐다. 전체 WCAG·스크린리더·모든 브라우저 검증이나
제품 무결함 보장은 여전히 이 결과의 범위가 아니다. 샘플 제품 수정·다른 소비 프로젝트 변경·배포는 없다.
설치·자동 검사·이 후속 확인 기록은 현재 Harness 로컬 문서 브랜치에 있으며 아직 원격 병합되지 않았다.

### PR 전달 전 증거·공개 범위 보완 (2026-10-06)

독립 검토에서 설치 전환의 원본 CLI 출력·skills/list 전체 응답·설정 비교 전후 원본은 보존되지 않았음을
확인했다. 위의 역사적 보고와 구조화된 값은 남기되, 이 기록만으로 당시 설치 전환·설정 복구를 독립
재검증하는 것은 **UNVERIFIED**다. 부모 agent가 실행한 전체 QA/대비의 최초 횟수·exit 값도 당시
실행자의 보고이며, 전체 tool-event 원본을 보존했다는 뜻이 아니다. 재설치로 과거 증거를 만들지 않았다.

대신 현재 공식 CLI plugin/marketplace 조회, source HEAD, source-vs-cache native 검사와 새 app-server
skills/list를 다시 확인했다. enabled 0.80.0, 발행 source SHA 일치, native 계약 exit 0, Harness 스킬
17개 enabled/로딩 오류 0의 **현재 상태는 VERIFIED**다. 대상 응답 발췌·실제 명령·결과와 역사적 한계는
실행 근거의 `currentInstallationRecheck`·`evidenceRetention`에 구분한다.

전체 quality 로컬 재현은 최초 후보 e77aa89에서 31개 단계 통과 후 32번째 공개 안전성 검사에서
개인 홈 경로 때문에 실패했다. 나머지는 그 실행에서 미실행이다. 기록의 개인 홈 접두어를
`<USER_HOME>`으로 정규화해 공개용 표현으로 바꿨고 검사는 완화하지 않았다. 원래 raw log SHA는
정규화 전 bytes의 값으로 유지하며 정규화 후 SHA도 따로 기록한다. 실행 스크립트·명령 표현은
실제 경로를 그대로 재실행할 파일이 아니라 공개용 치환본임을 명시한다. 설치 전환 원문 미보존과
공개 경로 실패는 지우지 않고 보존한다. 코드/플러그인 동작·샘플은 변경하지 않았다.

### 기록 전달 PR (2026-10-06)

[PR #483](https://github.com/grinvi04/team-harness/pull/483)이 설치 이후 기록 3개를 develop에 전달한다.
위의 로컬 보관/미병합 표현은 해당 단계 당시 상태이며, 최신 병합·CI·리뷰 상태의 정본은 이 PR이다.
첫 quality 실행은 1~31 통과/32 실패/33~63 미실행으로 보존했다. 개인 경로 정규화 후보 6c89eb7에서는
1·31~63을 모두 exit 0으로 확인했고, 관련 코드/시험/workflow 입력이 동일한 2~30 결과는 재사용했다.
ruff 0.15.15는 임시 venv에 미리 설치해 같은 실제 ruff 명령을 실행했다. 다른 단계 명령은 workflow와 같다.

독립 `harness-verifier`는 e77aa89의 증거 공백을 지적했고 6c89eb7에서 한계 표시·현재 조회·digest를
원본과 대조해 지적 해소/추가 지적 없음으로 판정했다. 최신 문서 상태와 이 전달 기록도 최종 후보에서
대조한다. 원격 CI·스레드·외부 status·현재 develop 보호 요건은 로컬 green으로 대체하지 않는다.
제품·플러그인 동작·버전·설치 상태는 이 전달 변경으로 수정하지 않는다.


### 0.81.0 전역 설치와 완료 경계 (2026-10-07)

사용자가 완료 시점까지 계속 진행하도록 요청했다. 범위는 발행 태그 설치 → 새 세션 로딩 → 샘플
통합 검증 → 관련 기록 현행화와 독립 검토다. 네 소비 프로젝트 수정·배포와 모델·역할 변경은 보류한다.

| 필수 범위 / 선정 이유 | 기대 결과와 관찰 경계 | 결과 |
|---|---|---|
| 발행본 설치 / 개발 후보 혼입 방지 | 공식 CLI 태그 v0.81.0, source HEAD=main 태그, cache inventory·digest 일치 | PASS |
| 설정 보존 / 전역 영향 제한 | Team Harness 두 설정 구역 외 문자열 동일 | PASS |
| 샘플 새 세션 발견 / 실제 소비 경계 | forceReload skills/list에서 17개 enabled·0.81.0 경로·로딩 오류 0 | PASS |
| 설치 계약 읽기 / 발견만으로 실행 계약 전달을 보장하지 않음 | 설치 cache의 native wrapper·common contract·native-runtime·risk-boundaries 읽기 | PASS |
| 샘플 전체 gate / 제품 통합 및 격리·종료·저장 경계 | 같은 제품 후보의 check-local.sh 모든 단계 exit 0, 제품 Git 변경 없음 | FAIL |
| 기록 대조 / 과거 결과와 현재 상태 구분 | 최초 실패와 미실행·설치 완료·통합 미완료 및 검토 상태 연결 | 실행 근거와 전달 PR 참조 |

[실행 근거](qa-install-v0.81.0-evidence.json)에 공식 CLI 출력·원본 digest·새 skills/list 발췌를 보존했다.
공식 절차는 [OpenAI plugin 안내](https://developers.openai.com/plugins/build/plugins)의 marketplace 명령과
[Native Refresh Runbook](codex-guard-compatibility.md#codex-native-refresh-runbook)을 따른다.
0.80.0의 당시 기록은 보존한다. 현재 설치는 0.81.0이며 새 app-server에서만 로딩을 검증했다.
기존 열린 대화의 catalogue 교체와 hook 런타임 발화·권한 집행은 이 결과로 증명하지 않는다.

샘플 전체 명령의 최초 실행은 실행 관리자 16개 시험 중 재시작 후 stop returncode=1로 exit 1이었다.
그 뒤 backend·frontend·영속성 단계는 미실행이다. 임시 관찰 wrapper로 해당 시험의 stop 응답을 수집한
1회 진단은 exit 0이었다. 최초 실패를 해소하지 못했으므로 통합 판정은 **NOT VERIFIED**다.
샘플 코드는 수정하지 않았고, 불안정 시험을 재시도 PASS로 바꾸거나 기준을 내리지 않는다.
완료에는 이 실패의 원인·복구 근거와 전체 gate 성공이 필요하다. 제품 수정이 필요하면 보류 범위의
변경 승인 후 처리하며, 새 실패·진단 결과를 기존 기록에 연결한다.


같은 16개 시험에 stop 응답과 manager log 관찰만 추가한 진단은 다른 dead-control-socket 시험에서
실패했다. stop은 관리자 연결 실패, manager log는 `Operation not permitted` 였다.
권한 오류를 일으킨 시스템 호출과 최초 실패의 원인은 미확인이다. 권한 우회나 제품 수정은 하지 않았다.


독립 `harness-verifier`는 현재 문서 3개·raw digest·설치 inventory·새 skills 응답·전역 설정의
두 구역 외 동일성과 샘플 HEAD/clean 상태를 대조해 추가 finding 없음으로 보고했다.
최초 CLI 종료 코드는 실행 tool 결과에 의존하며 저장 stdout만으로 종료 코드를 재검증할 수 없다는
한계를 유지한다. 샘플 실패 원인·전체 gate·hook 발화는 여전히 미확인이다.

Harness 문서 전달을 위한 로컬 quality 63단계는 모두 exit 0이었다. 임시 venv의 ruff 0.15.15를
사용해 같은 검사 명령을 실행했다. 이 결과는 샘플 전체 gate 실패를 대체하지 않는다.

설치·실패 기록 전달과 최신 원격 CI·검토·병합 상태는
[PR #491](https://github.com/grinvi04/team-harness/pull/491)의 현재 후보 원본을 따른다.
