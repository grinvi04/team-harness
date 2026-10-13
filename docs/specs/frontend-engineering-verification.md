# 프론트 설계 연결 검증 — 0.93.0 후보

이 문서는 b8d2c79 후보 당시 기록이다. [현재 통합 상태](frontend-contract-integration.md)를 먼저 확인한다.
[원래 수용 기준](frontend-engineering-contract.md)을 따른다. 2026-10-13 격리 합성 fixture를 사용했다.
[실측 기록](../pilots/frontend-contract-codex-v0.93.0.json)과 [quality 기록](../pilots/frontend-contract-quality-v0.93.0.json)에
원본 digest·명령·후보·최초 실패·최종 결과를 남겼다. 공개 기록의 로컬 경로만 변수로 정규화했다.

## 반영과 reader

핵심 기준은 설치되는 `skills/ao-coordinate/project-contract.md`에 있다.
기존 plan·feature-add·feature-modify·진단 wrapper의 공통 읽기 경로를 재사용했다.
상세 안내·기존 디자인 표준·소비 AGENTS·README를 연결했고 두 manifest와 배지를 0.93.0으로 맞췄다.
별도 설계·승인·QA 절차, UI 라이브러리·그리드·폴더·계층·의존성·중앙 상태표는 추가하지 않았다.
공통 계약 SHA-256은 `37991a695277bf5712ca36a61d3db46cef86fcaaf9f9c9bceb16b73df53123b1`이다.

## 실제 Codex 실행

CLI 0.161.0, 기존 설정 gpt-6.1-sol/high, `--ephemeral --sandbox read-only --json`으로 실행했다.
JSON 실행의 개별 model/effort 헤더는 별도로 수집하지 않았다. 현재 설정과 실행 인자를 구분해 기록한다.
프로젝트 로컬 `.agents/skills`에서 소스와 동일한 native wrapper→공용 skill→공통 계약을 읽었다.
상세 Harness docs는 fixture에 제공하지 않았다. 전역 marketplace 설치·hook 발동 검증이 아니다.
사용자 plugin 설치·설정 변경은 수행하지 않았다.

| 조건 | 변경 전 | 변경 후 | 의미 대조 결과 |
|---|---|---|---|
| 올바른 호출별 비활성화, 수량 편집 설계 | 5회 적합 | 4회 적합·1회 불완전 | 기존 업무·원본/초안·서버 응답·역사 금액·409·기존 QA 연결 |
| 버튼 문구 수정 | 1회 적합 | 1회 적합 | 문구·접근 가능한 이름·기존 클릭 보존만 확인 |
| 백엔드 빈 입력 거부 | 1회 적합 | 1회 적합 | 정규화 유지·오류/경계 확인, 프론트 검사 제외 |
| 별도 실행 서버 진단 (`--no-daemon`) | 비적용 | 1회 적합 | 동일 입력에서 온전한 변경안; 재발 방지나 원인 확정은 아님 |

이 15회 모두 공통 계약 전문 읽기·exit 0·완료 turn을 확인했다. 파일 변경 이벤트는 없었다.
내용이 적합한 14회는 현재 fixture 계약과 수동 대조했다. 별도 승인·QA 루프나 새 의존성 요구는 없었다.
검색/선택 실제 동작과 API 구현이 없다는 한계도 명시했다. 패널 입력과 공통 표의 선택적 확장 등
구조 선택은 달랐지만 현재 책임·보존·소비자에 근거했다.
`candidate-frontend-11`은 exit 0·완료 turn 뒤 최종 답변이 94자로 끝났다. F1 결과는 FAIL이다.
계약 읽기 성공과 답변 완료/적합성은 다르다. 이 실패는 제외하거나 PASS로 바꾸지 않았다.
공유 서버 가설을 확인하려고 동일 입력에 `--no-daemon`을 적용한 1회가 적합했지만 원인은 미확인이다.
모든 Codex 실행의 완전한 준수는 보장하지 않으며 해당 응답은 승인·구현 인계의 근거로 쓰면 안 된다.

초기 비교 14회도 의미 대조는 적합했지만, 따옴표를 넣은 CLI 키가 별도 잘못된 plugin 이름으로 해석돼
구버전 비활성화가 적용되지 않았다. 격리 증거로 세지 않고 원문을 보존했다.
수정된 키의 `plugin list --json`에서 0.92.0 enabled=false를 확인한 뒤 위 14회를 재실행했다.
그 전 최초 baseline 1회는 symlink 상대 참조에 실패해 제외했다. 양쪽 fixture에 같은 realpath 안내를 추가했다.
총 30회(설정/fixture 보완 포함)의 실행 시도와 29개 완료 응답을 보존한다.
변경 전도 업무 계약에 따라 좋은 판단을 했다. 이 표본으로 품질 개선의 인과를 주장하지 않는다.
이 실행은 변경안 제안이며 앱 구현·실제 저장·사용성·미학 검증이 아니다.

## 회귀·패키지

구조 RED에서 기존 8개는 통과하고 신규 2개는 누락 때문에 실패했다. 줄바꿈·동의 표현을 잘못 가정한
초기 검사식을 의미 계약에 맞춰 정정했다. 현재 구조 검사는 10개 모두 통과한다.
CI quality의 run 74단계를 macOS에서 수행했다. 최초 실패 3개는 원인을 확인한 뒤 영향 재검사로 통과했다.
Linux apt는 기존 rg 확인, PR event는 실제 스펙 `--record`, pipx는 같은 Ruff 0.15.15의 격리 venv로 대체했다.
Python은 bundled 3.12.14를 사용했다. GitHub-hosted CI 실행을 주장하지 않는다.

- 28: task Ruff venv의 외부 interpreter symlink가 탐색에 걸렸다. 도구를 repo 밖으로 옮겼다.
  첫 재검사 cwd 오류와 다음 재검사의 parser 환경 누락도 보존했다. CI-equivalent 환경의 재검사는 45/45 통과했다.
- 43: 공개 실측 index의 로컬 경로를 변수로 정규화했다. 원문·digest는 유지했으며 공개 안전성 20/20 통과했다.
- 60: 승인 범위의 공통 계약 변경에 해당하는 Claude-surface checksum 한 행만 갱신했다.
  다른 승인 source hash·플랫폼 경계·차단 assertion은 보존하고 native/Claude 검사에 통과했다.

구현 후보 `89d522262bd7881f2c111a317f3bf80b2d218078`의 package 4개와 source-only bundle을 생성했다.
bundle checksum은 통과했다. 테스트한 핵심 계약과 package 파일의 bytes도 일치했다.
생성기는 기록된 HEAD를 읽으며 package는 실험 installable=false 상태다. 태그 발행이나 사용자 설치가 아니다.
원격 태그 조회 전 changelog 생성에서 과거 기록이 빠졌다. 첫 독립 검토가 이를 발견했고
원격 v0.88.0–v0.92.0 태그를 fetch한 뒤 생성기로 복구했다. 최신 생성물은 v0.93.0 한 항목만 추가한다.

## 독립 검토·현재 판정

별도 CLI Astra/medium의 첫 검토는 변경 경계의 7개 관점과 원본 14회를 대조했다.
F1–F5는 초기 표본 범위의 적용을 확인했고, 당시 F6는 changelog 회귀·미실행 품질 때문에 미확인이었다.
실제 헤더의 model/effort/read-only와 shell의 임시 cache 쓰기 거부를 관찰했다.
요청한 sentinel 쓰기는 상위 정책 때문에 수행하지 않아 그 지정 probe의 집행은 미확인이다.
구현자 자신을 독립 검토자로 세지 않았으며 첫 후보의 미확인과 발견을 보존한다.

최종 독립 대조는 F1 FAIL, F2–F4 표본 범위 PASS, F5 적용 확인으로 판정했다.
F6의 당시 미확인은 후속 로컬 후보 `2051ea46cd9173b5bff1d1e5ec288fb616c5e65b`에서 대조했다.
package 4개·source-only bundle 재생성, 두 checksum, 핵심 계약 bytes 일치, committed 문서 선언·
changelog·native loader 검사는 통과했다. 이 후속 package 대조는 현재 담당자의 직접 검사이며 독립 검토로 세지 않는다.
최초 changelog 회귀와 checksum 갱신은 해소·적합으로 판정했다. 전체 완료 선언 불가는 유지한다.
소스 반영, 기준의 실제 읽기와 적합한 적용 표본, 로컬 회귀를 확인했다.
불완전 응답 1회가 있어 실행 일관성 전체 통과로 판정하지 않는다.
원격 PR·병합·릴리즈·사용자 설치와 실제 제품의 사용성·회사 채택은 별도 상태다.

## 인계 상태

전체 수용 검증 완료는 보류한다. `candidate-frontend-11`의 불완전 응답 원인은 미확인이다.
새 원인 증거 없이 같은 조건의 호출을 더 반복하거나, 검사 조건을 완화하거나, 중복 workflow를 추가하지 않는다.
후속 진단은 이 실패의 원문·당시 조건을 출발점으로 삼아야 한다. 새 환경의 1회 성공은 과거 실패를 없애지 않는다.
당시 설치된 사용자 Harness는 0.92.0·enabled=true였다. 0.93.0은 이 로컬 브랜치의 개발 후보다.
원격 전달·발행·사용자 설치는 실행하지 않았다. 후속 문서 현행화 커밋은 런타임 기준을 바꾸지 않는다. 마지막 Git·bundle manifest와 원본 실행은 작업 출력에 보존한다.
