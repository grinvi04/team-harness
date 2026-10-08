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

관련 판단 전에 [전체 본문](qa-command-binding-validation-execution.md)을 읽는다.

## PR 준비와 전달 상태 (2026-10-01)

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### PR 사전 검사에서 발견한 문서 크기 결함

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### PR 생성 완료

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### CI·리뷰 판정과 전달 게이트

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### 0.80.0 릴리즈 사전 검증 (2026-10-01)

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### 0.80.0 정식 릴리즈 진행 (2026-10-01)

관련 판단 전에 [전체 본문](qa-command-binding-validation-delivery-v0.80.0.md)을 읽는다.

### 0.80.0 발행과 develop 반영 (2026-10-03)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.80.0.md)을 읽는다.

### 0.80.0 전역 설치와 샘플 설치본 검증 (2026-10-03)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.80.0.md)을 읽는다.

### 샘플의 전체 로컬 자동 검증 (2026-10-03)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.80.0.md)을 읽는다.

### 색상 대비 needs-review 후속 확인 (2026-10-06)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.80.0.md)을 읽는다.

### PR 전달 전 증거·공개 범위 보완 (2026-10-06)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.81.0.md)을 읽는다.

### 기록 전달 PR (2026-10-06)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.81.0.md)을 읽는다.

### 0.81.0 전역 설치와 완료 경계 (2026-10-07)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.81.0.md)을 읽는다.

### 승인된 샘플 종료 결함 수정과 최종 통합 (2026-10-07)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.81.0.md)을 읽는다.

### 샘플 의존성 보안 후속 (2026-10-07)

관련 판단 전에 [전체 본문](qa-command-binding-validation-release-v0.81.0.md)을 읽는다.

### 샘플 승인된 로컬 깊이 보완 (2026-10-07)

사용자가 공식 수정판 없는 braces에 대해 고정 [PR #78](https://github.com/micromatch/braces/pull/78)
기반 샘플 로컬 보완과 전체 QA를 명시적으로 선택했다. 샘플 로컬 커밋
`431523d02cbe97e959df0b4c87a1d3ebc8ac46b0`은 npm 3.0.3의 lib 6파일에 고정 diff를
적용하며 패키지 버전·원본/결과 지문을 전 파일에서 검증한 후 쓴다. drift는 설치 실패이며
재실행은 쓰기 없이 성공한다. canonical 명령에 보안 회귀와 그 실패 중단을 연결했다.
공용 Harness의 설치/guard 동작·버전은 바꾸지 않는다.

제품 첫 전체 QA exit 0: 보안 7·명령 회귀 4·lifecycle 18·unit 76·Chromium 49,
타입/lint/build·실제 격리 DB 재시작/동일 등록 키 재요청 PASS다. backend는 재사용이다.
micromatch/fast-glob 깊은 입력 제어 거부와 고정 lint 패턴 정상도 확인했다.
독립 보안 검토는 설치기의 실제 적용·재실행·마지막 파일 drift 전 파일 무변경을 시험했고
현재 후보·QA 원문에 finding 없음/PASS다. 공식 3.0.3 태그/npm 원문과 기존 764개 시험을
보존하고 PR의 새 14개만 추가해 같은 제품 백포트로 778 PASS를 확인했다.
upstream head의 908 PASS는 별도 parser 변경이 있는 후보여서 같은 제품 증거로 쓰지 않는다.

보완과 정상 parser/정상 형태 AST의 깊이 차단은 VERIFIED다. 비정상 AST·regex CPU·출력
조합 폭증은 미보장이다. 기존 앱 시험과 잠근 새 시험 원문은 유지했으며 명령 회귀만 새
단계에 맞게 확장했다. 이미지/DB는 이전 검증 baseline과 동일하며 새 실행 전 snapshot으로
주장하지 않는다. 최초 실패·재시도와 후보 지문은
[bracesMitigationFollowup](qa-install-v0.81.0-evidence.json)과 제품 원문에 보존한다.

전체 감사 exit 1/high 5와 전체 취약점 제거 FAIL/미완료는 유지한다. 운영 감사 exit 0/0건은
별도 범위다. 정식 호환 수정 릴리즈를 검토해 보완을 제거한 뒤 전체 감사·동일 QA를 확인한다.
제품 원격 게시·배포·기존 서버 재시작·네 소비 프로젝트·전역 설정은 수행하지 않았다.
기록 전달·필수 CI·병합의 최신 상태는 [PR #494](https://github.com/grinvi04/team-harness/pull/494)의 원본을 따른다.
