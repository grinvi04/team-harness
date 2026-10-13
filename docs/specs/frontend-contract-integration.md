# 프론트 설계 연결 · 최신 기반 통합

## 승인·범위

2026-10-13 사용자가 이 대화에서 작업 순서와 완료 기준에 따른 끝까지의 로컬 실행을 승인했다.
목표는 실제 제품 개발에 사용할 Team Harness 자체 개선이다. 제품 방향 판정은 **연결**이다.
[원래 F1–F6](frontend-engineering-contract.md)의 기준·표본 수·실패 보존 계약을 변경하지 않는다.
원격 develop `4d62011de13cebadc43eef70abe1e62605fa2e1b`의 0.92.1과 도입 범위 정정
`d82b43daf49b2ecfb246bca556a19c8b9a56a400`을 기반으로 승인된 frontend delta만 통합한다.
원래 구현 후보는 `b8d2c79da97c7f1029332479ebf77a8122e3c7b4`다.

소비 저장소 수정·실제 회사 인수·전역 설정·PR/push/병합/태그/설치/배포는 제외한다.
현재 발행·설치 0.92.1과 새 로컬 0.93.0 후보를 구분한다.

## 작업 순서·완료 기준

| 순서 | 작업 | 판정 기준·현재 상태 |
|---|---|---|
| 1 | F1 원문·실행 환경 진단 | 완료: 과거 누락·원인 미확인 보존; 현재 표본 수용과 구분 |
| 2 | 최신 기반 통합 | 로컬 완료: 정책·보호·d82b43d 문서와 reader bytes 보존 |
| 3 | 현재 후보 검증 | 현재 F1–F5 표본 PASS·quality74/74·package/checksum·독립 검토 |
| 4 | 문서·전달 준비 | 최종 문서·HEAD archive를 대조한 로컬 인계; 원격 delivery 제외 |

현재 표본은 원래 F1–F5를 충족했다. 과거 F1 FAIL을 지우거나 원인 해결로 승격하지 않는다.
전체 quality와 source package는 통과했다. 최종 보고-only HEAD의 문서·archive 확인을 인계 증거로 연결한다.
새 원격 delivery는 실행하지 않았다. 현재 수용은 지정 표본·로컬 구현 검증 범위다.

## F1 진단과 중단 기준

`candidate-frontend-11`의 출력 파일과 JSONL 최종 agent_message는 같은 94자다.
exit 0·48.13초·turn.completed이며 계약 전문 읽기와 도구 명령 성공을 확인했다.
따라서 출력 파일만 잘림·외부 timeout·계약 bytes 읽기 누락은 배제한다. 이해·적용은 미확인이다.
stderr sandbox 경고의 경로는 unknown이다. 도구 출력에는 Python 임시 cache 생성 거부가 있다.
같은 종류의 거부는 정상 no-daemon 표본에도 나타나며, 응답 누락의 원인으로 확정할 수 없다.
해당 시각 OS sandbox 로그는 revisiond 기록만 반환했고 Codex 거부의 추가 근거는 없었다.
원래 thread 조회도 durable 호스트 오류로 확인하지 못했다. 부재나 원인 확정으로 처리하지 않았다.
당시 실제 model/effort·서버 finish reason·stream delta·daemon 요청 매핑은 확보하지 못했다.

기존 `--no-daemon` 성공 1회로 원인을 확정하지 않는다. 성공 횟수만 늘리는 재시험은 하지 않는다.
실행 플랫폼 내부·cache·보호·출력 강제 workflow를 추측으로 바꾸지 않는다.
위 조건은 당시 원인 진단의 중단 기준이다. 원래 F1의 현재 후보 수용 시험을 금지하는 조건은 아니다.
과거 원인 복구·회사 대상 지정은 현재 후보 재검증의 선행조건이 아니다.

## 2026-10-13 진단 재개

사용자의 재개 요청으로 기존 로그 조회와 공식 process-local 관찰 준비를 수행했다.
실패 thread ID의 로컬 state/log 조회는 0행이다. 조회 범위의 부재이며 요청 자체의 부재 증명은 아니다.
로컬 HTTP 수집기·설정 파싱과 단독 1회로 관찰 경로를 확인했다.
이 새 관찰 근거를 바탕으로 원래 동시 실행2 조건을 한 쌍만 비교했다. 진단은 총3회, 새 F1 수용 시험은0회다.
[공식 OTLP 설정](https://learn.chatgpt.com/docs/config-file/config-advanced)과
[0.161.0 agent-response 옵션](https://github.com/openai/codex/blob/979011409de0a60b52f179721948e65531d26144/codex-rs/otel/src/agent_response.rs#L44)을 사용했다.
실제 CLI0.161.0·Sol6.1/high·read-only·approval never와 완료 메시지 관찰을 확인했다.
최종 2,894/2,832/3,371 UTF-8 bytes는 각각 core 완료 ResponseItem·CLI JSONL·파일이 같고 truncation=false다.
각 실행의 conversation 연결과 서로 다른 ID를 확인했다. core 이후 손실·완료 오류는 관찰되지 않았다.
wire raw payload나 과거 인과는 미확인이다. 원래 model/effort도 미확인이므로 동시성 결함의 부재 증명은 아니다.
관찰한 세 답변은 변경안을 포함하지만 원래 실패는 보존하며 F1 재수용 표본으로 세지 않는다.
loopback 수신 후 파일 저장 전에 account/email 속성을 가리고 prompt는 redacted로 유지했다.
collector 종료와 설정·fixture·HEAD 불변을 확인했다.
당시 관찰 준비는 완료했지만 원인에 맞는 Harness 수정 근거는 없었다. 당시 F1 FAIL·NO-GO는 보존한다.
실행 원문은 기존 `.runtime/frontend-resume-20261013/f1-observation-1/`부터 `-3/`까지 보존한다.
종합 비교는 같은 디렉터리의 `f1-observation-comparison.json`이다. 정한 한 쌍 뒤 추가 성공 반복은 하지 않는다.

## 현재 후보 수용 재검증

2026-10-13 사용자가 과거 기록의 무시·기준 완화 대신 원래 시험과 검증을 계속하도록 정정했다.
현재 후보 `3fd67cf`와 0.92.1 기반의 fresh 합성 fixture에서 동일 prompt·F1 기준을 유지한다.
F1은 변경 전/후 각각5회, 작은 문구/백엔드는 각각1회로 총14회다. F2/F5는 같은 실행을 대조한다.
Sol6.1/high·read-only·동시2·default daemon·300초를 유지하고 core/JSONL/file을 관찰한다.
exit0이나 출력 일치만으로 의미 PASS를 만들지 않으며 모든 시도를 보존한다.
과거94자 FAIL·원인 미확인은 당시 기록으로 유지한다. 현재 판정은 새 원문·독립 검토로 결정한다.
고정14회 모두 온전한 실행·응답을 수집했다. F1은 baseline5/candidate5 모두 업무·상태·구조·QA를 설명했다.
F2/F3/F4의 승인 재사용·작은 변경·백엔드 비적용과 F5의 실제 읽기·적용도 표본 PASS다.
실제 read-only Astra/medium 독립 검토가 원문14개와 제외3개를 읽고 F1–F5 PASS로 판정했다.
전체 quality74/74와 source package/checksum은 통과했다. F6 최종 문서·HEAD archive는 아래 인계 증거로 대조한다.
baseline도 통과했으므로 이번 연결의 인과적 품질 향상·재발 방지·회사 효용은 입증하지 않는다.
최초 계측3회는 bind 오류로 exit 미보존하여 모두 제외했다. 원문을 보존하고 runner를 고쳐 fixed14만 실행했다.
준비·preflight·비교기 가정 오류와 무모델 selftest도 보존했다. TIME_WAIT이라는 구체적 원인은 추정이다.
원문과 프로토콜은 `.runtime/frontend-current-acceptance-20261013/`에 보존한다.

## 기존 증거의 정확한 재사용 경계

[당시 실행 기록](frontend-engineering-verification.md)의 F1 FAIL과 F2–F5 표본 판정을 보존한다.
공통 계약·native-runtime·plan/feature-modify wrapper와 공용 skill의 bytes를 대조한다.
기존 feature-add/systematic-debugging reader도 보존하지만 실제 적용 실행으로 세지 않는다.
fixture·승인 문서·prompt는 baseline/candidate가 동일하다. 상세 Harness docs 없는 설치 형태다.

F2는 이미 승인/QA가 주어진 읽기 전용 제안, F3은 버튼 문구, F4는 프론트 비연결 명시 과제다.
F5는 repo-local symlink·AGENTS 안내로 wrapper→공용 skill→공통 계약을 읽은 범위다.
전역 plugin 설치·hook 발동·자동 선택·실제 제품 저장/UI·모든 모델의 준수를 증명하지 않는다.
현재 0.92.1 정책 보존과 새 Git 후보의 품질·패키지는 과거 표본과 별도로 검사한다.

## 현재 검증 기록과 영향 문서

과거 진단은 `.runtime/frontend-resume-20261013/`, 현재 원문·실행·해시는
primary 프로젝트의 `.runtime/frontend-current-acceptance-20261013/`에 보존한다.
공개 요약은 [현재 후보 검증](../pilots/frontend-integration-v0.93.0.json)에 연결한다.
현재 코드·quality·원문 독립 검토·source package 후보는 `3fd67cfbff56ea06112473c16dd775efbd9b1571`다.
macOS 로컬 실행이며 Linux apt는 기존 rg, PR event는 실제 스펙, Python은 bundled 3.12,
Ruff는 동일 고정 버전의 외부 격리 venv를 사용했다. 명령·환경·최초 시도 기록을 보존했다.
현재 native source의 manifest/hook/17개 skill과 package 4개·소스 bundle checksum을 확인했다.
분리 package의 catalog 버전 0.69.0·installable=false는 기존 실험 계약이며 plugin 0.93.0과 구분한다.
이전 독립 검토의 F1 FAIL은 과거 snapshot에 보존한다. 현재 독립 검토는 F1–F5 PASS, F6 최종화 PENDING이었다.
표현 링크 결함은 비차단 한계로 보존한다. 원래 b8d2c79 객체의 reader/guide/test13개를 원본 checkout에서 직접 대조했다.
최종 문서 기록만 달라진 후보의 runtime/test/CI 동일성을 대조하고 해당 문서 검사를 수행한다.
최종 source bundle의 정확한 후보는 `artifacts/final/bundle/RELEASE-MANIFEST.json`과 Git HEAD에서 확인한다.
같은 현재 증거 루트의 `final-verification.json`에서 문서·archive·독립 문서 대조·지도 결과를 확인한다.
최종 인계 전 이 확인이 필수다. 정식 release-check·PR·태그·설치는 실행하지 않았으며 릴리즈 GO로 해석하지 않는다.
공통 계약·frontend 안내·디자인 표준·소비 AGENTS·README·decisions·harness-maintenance와
두 manifest·CHANGELOG를 함께 대조한다. 회사 인수의 원래 기준·미확인 상태는 변경하지 않는다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {"path":"docs/specs/frontend-contract-integration.md","reason":"승인 범위와 현재 후보의 수용·전달 상태"},
    {"path":"docs/specs/frontend-engineering-contract.md","reason":"최초 F1–F6 기준 보존과 현재 reader 연결"},
    {"path":"docs/specs/frontend-engineering-verification.md","reason":"과거 후보 당시 결과 보존과 현재 상태 연결"},
    {"path":"docs/pilots/frontend-integration-v0.93.0.json","reason":"최신 후보 품질·보존·패키지·독립 판정"},
    {"path":"docs/frontend-engineering.md","reason":"설치된 핵심 기준의 상세 사용 안내"},
    {"path":"docs/frontend-design-standards.md","reason":"기존 설계·QA 흐름 재사용"},
    {"path":"templates/AGENTS.md","reason":"소비 표준 읽기 경로"},
    {"path":"docs/decisions.md","reason":"제품 방향 연결 판정"},
    {"path":"docs/harness-maintenance.md","reason":"로컬 후보와 수용·발행·설치 상태 구분"},
    {"path":"README.md","reason":"프론트 안내와 후보 버전 배지"},
    {"path":"CHANGELOG.md","reason":"0.92.1 이력 보존과 0.93.0 후보 생성"},
    {"path":"docs/changelog/releases.md","reason":"현재 생성된 이력 index"},
    {"path":"docs/changelog/2026/v0.93.0.md","reason":"현재 후보의 실제 커밋 이력"}
  ],
  "items": []
}
```
