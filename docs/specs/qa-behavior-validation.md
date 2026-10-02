# QA 계약의 행동 평가와 경계 사례 연결

## 승인 범위와 설계

2026-09-29 사용자가 승인한 후속 작업은 Harness 자체의 테스트·QA 보강이다. 소비 프로젝트의
수정·배포는 보류한다. 이전 [제품 검증 기록](multi-project-qa-validation.md)의 결과는 당시
후보의 이력으로 보존하며 이번 작업의 제품 QA 통과 증거로 재사용하지 않는다.

제품 방향: 항목별 QA 결과 계약과 평가 자료는 **소유**, 기존 스킬·native 실행은 **연결**,
제품별 시험 구현과 에이전트 실행기는 **위임**한다. 새로운 agent runtime이나 상시 유료 CI를 만들지 않는다.

| 요구 | 수용 기준 | 검사 |
|---|---|---|
| 실제 사례를 실행 계약에 연결 | 관계 이동·캐시 소비자·비동기 종결·실제 인증/fixture를 위험에 따라 선택 | 배포되는 참조와 진입 링크 검사, 사례별 판단 평가 |
| 완료 판정의 검출력 | 불충분한 증거 5종은 완료 불가, 작은 문구 변경은 과잉 검사 없이 완료 허용 | 고정 사례와 독립 채점표로 원문 검토 |
| 작업 범위 보존 | Harness 기준을 실제 수정하고 소비 fixture bytes 보존 | 실행 전후 파일과 도구 기록 대조 |
| 반복성 | 같은 모델·추론 설정, 매회 새 컨텍스트, 대조군/후보 각 5회 | 실행 자료·차이·한계 기록 |
| 배포 일관성 | 공통 source→Codex wrapper/package 연결, 버전·문서 동기화 | 저장소 quality gate와 독립 검토 |

## 반복 시험 절차

입력은 [tasks.json](../../tests/fixtures/qa-behavior/tasks.json), 판정자는
[rubric.md](../../tests/fixtures/qa-behavior/rubric.md)다. 입력과 채점 기준을 실행 전에 고정한다.
피평가자는 정답표·다른 회차·기존 결과를 읽지 않는다. 전역/플랫폼 지침은 그대로 유지하며
대조군은 추가 Harness 본문을 제공하지 않는 조건이다. 모든 지침이 없는 모델과의 비교가 아니다.

1. 회차마다 새 격리 폴더에 tasks.json, `fixture/harness/qa.md`(기존 테스트 통과),
   `fixture/consumer/lock.mjs`(`return !newParent.closed`)를 준비한다. 두 fixture 모두 쓰기 가능하다.
2. 대조군을 먼저 실행해 관찰 경계의 실제 누락을 기록한다. 후보군에는 현재
   verification-before-completion 본문과 그 상대 참조를 함께 복사해 먼저 읽게 한다.
3. 동일한 native 실행기·모델·추론 강도로 매회 새 세션을 연다. 상위 작업 이력은 전달하지 않는다.
   사례마다 범위·구체 검사/기대 결과·현재 판정·다음 행동을 받고 scope 사례는 실제 파일에 수행한다.
4. 현재 도구 동시 실행 한도를 지킨다. 모델/인증/권한 오류는 행동 실패와 구분하고 성공으로 세지 않는다.
   환경 복구 뒤 재실행은 이유를 기록한다. 전역 설정·설치형 플러그인은 변경하지 않는다.
5. 각 답변을 사람이 채점 기준과 대조한다. 키워드/JSON 검사 통과를 행동 PASS로 세지 않는다.
   독립 검토자는 후보와 원문 응답을 읽고 누락·과잉 범위·성공 주장 과장을 반증한다.
6. 원문 응답, fixture 결과, 입력/후보 digest, 실행 설정·원본 이벤트 digest, 사례별 판정과 누락을
   저장한다. 예비 실행과 채점 대상, 구조 검사와 행동 검사를 구분한다.

실행 예시(경로는 해당 회차의 격리 폴더로 바꾼다):

```bash
codex exec -m gpt-6-sol -c 'model_reasoning_effort="high"' \
  -s workspace-write --ephemeral --skip-git-repo-check -C /tmp/qa-run \
  --json -o /tmp/qa-run/response.json - < /tmp/qa-run/prompt.txt \
  > /tmp/qa-run/events.jsonl 2> /tmp/qa-run/stderr.log
```

이 절차는 명시적으로 제공한 계약의 준수를 평가한다. 자동 skill 선택·설치형 플러그인 로딩·
장기 작업에서의 지속 준수·모든 모델·모든 미지 결함 탐지는 별도 경계다. 합성 사례의 응답은
제품 시험 실행 증거가 아니며 fixture 무수정은 OS 권한 집행의 증거가 아니다. 작은 표본의
개선은 통계적 우월성·최적 비용이나 완전한 신뢰성의 증명이 아니다.

## 재평가 범위

QA 스킬의 판단 기준·참조 로딩·모델/실행 조건을 바꿀 때 관련 사례를 다시 고르고 동일 조건의
새 컨텍스트 반복을 수행한다. 보통 제품 변경마다 이 전체 비교를 반복하지 않는다. 링크·표기만
고치면 구조 검사를 적용하고, 실제 누락이 드러나면 그 반례를 사례/판정자에 먼저 추가한다.
평가 기준 변경은 이유와 버전을 기록하고 과거 응답을 새 기준에서 통과한 것처럼 덮어쓰지 않는다.

## 결과

최종 구현 후보는 `b0ec056ec52d1f1d83d042899a27d593d3398203`의 0.77.0 소스다.
[실행·원문 응답·독립 채점](qa-behavior-evidence.json)을 보존했다. 공통 계약과 참조 파일의 digest는
같은 기록에 결박하며 이후 문서 전용 커밋은 이 동작 후보를 바꾸지 않는다. 정식 릴리즈·설치형 plugin
갱신·소비 프로젝트 수정/배포는 하지 않았다.

| 같은 7사례 × 새 CLI 세션 5회 | 기준 충족 | 실제 누락 |
|---|---:|---|
| 추가 Harness 본문 없는 대조군 | 20/35 | 관계 이동의 간접 FK 판정자, 비동기 종결·영속/실패 경계, 인증·환경별 자격 |
| 최초 보강 후보 `b67dcad` | 24/35 | 간접 관계와 인증 조건이 검사명으로 축약; 5회차의 worker 종결 관찰 누락 |
| 하위 경계 판정자를 구체화한 최종 후보 `b0ec056` | 35/35 | 이번 고정 사례에서 필수 판정자 누락 미발견 |

비교 실행기는 Codex CLI 0.156.1이며 요청 설정은 `gpt-6-sol/high`다. 모든 회차는 같은 설정의
새 컨텍스트에서 실행했고 현재 전역/native 지침은 유지했다. JSONL은 실제 적용 model/effort를
별도 노출하지 않아 요청값과 실행 성공을 구분한다. 과금·계정 사용량·모델 최적성 비교는 아니다.
처음 app subagent 예비 실행 2회는 세션 생성 한도로 동일 실행기를 유지할 수 없어 위 집계에서
제외했다. 최초 CLI 시작은 sandbox의 runtime 상태 저장 제한으로 모델 실행 전 실패했으며,
승인된 실행 권한으로 동일 명령을 재실행했다. 전역 설정·인증·guard를 우회하거나 변경하지 않았다.

대조군도 불충분한 증거의 완료 거부, 필수 환경의 미확인 처리, 작은 변경의 적정 범위와 소비 코드
보존은 지켰다. 관찰된 개선은 **구체적인 시험 조건·기대 결과의 누락 감소**다. 작업 범위 보존의
개선 효과가 측정됐다고 주장하지 않는다. 15회 모두 Harness fixture를 실제 수정하고 소비 fixture
bytes를 보존했다. 독립 검토자가 고정 rubric으로 원문 응답·fixture를 채점했으며 기대 단어의
존재나 테스트 수만으로 PASS를 판정하지 않았다.

검증 결과:

- 참조 연결 구조 검사: 추가 전 51 PASS/1 FAIL → 연결 후 52 PASS/0 FAIL. 행동 증거와 구분한다.
- quality 잡 61개 실행 스텝을 로컬 재현했다. 기존 증거 문서의 홈 경로 표기로 1개가 실패했고,
  표시본 정정과 원본 digest 보존 후 통과했다. 최종 후보에서 영향받는 20개 스텝을 재검사해 모두
  통과했다. GitHub event는 로컬 선언 문서로, ruff 설치는 같은 버전의 기존 캐시로 대체했다.
  원격 CI 실행 결과나 PR/릴리즈 gate 통과를 의미하지 않는다.
- 커밋된 최종 후보로 package를 조립하고 배포되는 risk-boundaries.md와 원본 bytes 일치를 확인했다.
  기존 발견성·source 격리·Codex mapping과 패키지/릴리즈 bundle 검사도 통과했다.
- 이전 통합 증거의 홈 경로는 `$HOME`으로 표기했다. 원본 digest는 `originalSha256`, 표시본 digest는
  `sha256`로 구분하고 과거 후보·판정은 보존했다. 소비 제품 파일 변경은 없다.

판정: **승인된 Harness 소스 보강과 이 고정 사례의 행동 평가 완료**. 자동 스킬 선택·설치 후 새 작업에서의
적용·다른 모델·장기 문맥·미지 사례에 대한 준수는 이번 평가로 입증되지 않는다. 35개 판정은
5개 컨텍스트 안의 관련 사례이며 35개의 독립적인 일반화 시험이나 무결함 보장이 아니다.

## 문서 동기화

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path":"docs/specs/qa-behavior-validation.md","reason":"승인 범위·평가 기준·현재 결과"},
    {"path":"docs/specs/qa-behavior-evidence.json","reason":"원문 응답·후보 digest·품질 실행·독립 채점 증거"},
    {"path":"docs/specs/qa-scope-contract.md","reason":"후속 행동 평가 연결"},
    {"path":"docs/specs/multi-project-qa-validation.md","reason":"제품 작업 보류와 Harness 평가 경계"},
    {"path":"docs/qa-evidence-guide.md","reason":"현장 교훈의 실행 계약 연결"},
    {"path":"docs/specs/multi-project-integration-evidence.json","reason":"공개 안전성 검사에서 발견한 홈 경로 표기 정정, 원본 digest·판정 보존"},
    {"path":"docs/decisions.md","reason":"사례별 참조·native 평가 연결 결정"},
    {"path":"plugins/harness-guard/skills/verification-before-completion/SKILL.md","reason":"위험별 참조와 작업 범위 유지"},
    {"path":"plugins/harness-guard/skills/verification-before-completion/risk-boundaries.md","reason":"배포되는 QA 관찰 경계"},
    {"path":"README.md","reason":"소스 후보 버전"},
    {"path":"docs/intro.html","reason":"소스 후보 버전"},
    {"path":"CHANGELOG.md","reason":"구현 후보 변경 이력"}
  ],
  "items": []
}
```
