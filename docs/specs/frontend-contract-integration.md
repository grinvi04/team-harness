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
| 1 | F1 원문·실행 환경 진단 | 조사 완료, 생성된 최종 답변의 누락 확인; 원인 UNVERIFIED·F1 FAIL |
| 2 | 최신 기반 통합 | 로컬 완료: 정책·보호·d82b43d 문서와 reader bytes 보존 |
| 3 | 현재 후보 검증 | quality 74/74·package·소스 독립 검토 통과; F1 FAIL로 전체 수용 불가 |
| 4 | 문서·전달 준비 | 로컬 검토 후보와 미완료 인계 준비; 릴리즈 GO 판정 없음 |

2번 통합과 3번 기술 검증·4번 미완료 인계 기록을 수행했다. F1 FAIL로 전체 수용은 미완료다.
최종 검증은 아래 기록의 후보·범위와 raw 증거를 함께 대조한다. 새 원격 delivery는 실행하지 않았다.
전체 quality 성공·package 생성·별도 검토 수행은 F1의 의미 FAIL을 해소하지 않는다.

## F1 진단과 중단 기준

`candidate-frontend-11`의 출력 파일과 JSONL 최종 agent_message는 같은 94자다.
exit 0·48.13초·turn.completed이며 계약 전문 읽기와 도구 명령 성공을 확인했다.
따라서 출력 파일만 잘림·timeout·계약 로딩 실패는 배제한다.
실패 표본에만 sandbox 경고가 있으나 경로·operation이 unknown이고 응답 누락과의 인과는 없다.
해당 시각 OS sandbox 로그는 revisiond 기록만 반환했고 Codex 거부의 추가 근거는 없었다.
원래 thread 조회도 durable 호스트 오류로 확인하지 못했다. 부재나 원인 확정으로 처리하지 않았다.
당시 실제 model/effort·서버 finish reason·stream delta·daemon 요청 매핑은 확보하지 못했다.

기존 `--no-daemon` 성공 1회로 원인을 확정하지 않는다. 새 근거 없는 모델 호출은 추가하지 않았다.
실행 플랫폼 내부·cache·보호·출력 강제 workflow를 추측으로 바꾸지 않는다.
계속 진단하려면 해당 실패의 서버 종료/stream 또는 거부 경로 원문 같은 새로운 원인 증거가 필요하다.
이 조건은 실제 회사 인수나 소비 저장소 지정을 기다리는 조건이 아니다.

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

실행 원문·명령/cwd/exit·파일 SHA-256은 담당 작업의 `.runtime/frontend-resume-20261013/`에 보존한다.
공개 요약은 [현재 후보 검증](../pilots/frontend-integration-v0.93.0.json)에 연결한다.
코드·전체 quality·별도 소스 검토의 후보는 `de0fe7c391b3ed9e3bcb86a27790fd1744bb6dbc`다.
macOS 로컬 실행이며 Linux apt는 기존 rg, PR event는 실제 스펙, Python은 bundled 3.12,
Ruff는 동일 고정 버전의 외부 격리 venv를 사용했다. 명령·환경·최초 시도 기록을 보존했다.
현재 native source의 manifest/hook/17개 skill과 package 4개·소스 bundle checksum을 확인했다.
분리 package의 catalog 버전 0.69.0·installable=false는 기존 실험 계약이며 plugin 0.93.0과 구분한다.
별도 Astra/medium·실제 read-only 검토는 새 소스 결함 없음, F1 FAIL로 판정했다.
최종 문서 기록만 달라진 후보의 runtime/test/CI 동일성을 대조하고 해당 문서 검사를 수행한다.
최종 source bundle의 정확한 후보는 RELEASE-MANIFEST.json과 Git HEAD에서 확인한다.
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
