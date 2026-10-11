# 스킬 계약 통합과 릴리즈 적용 범위 정리

승인: 2026-10-11 사용자 요청. Superpowers와 중복되는 절차를 통합·대체하고
Harness 정책·검증·복구를 유지하며 release/release-check의 확인된 문제를 수정한다.

## 책임과 범위

- **위임:** 일반 설계·계획·TDD·디버깅은 선택한 Superpowers 또는 native 방법론 하나.
- **연결:** 기존 17개 호출 이름과 Codex wrapper는 유지하고 프로젝트 계약의 중복을 줄인다.
- **소유:** spec 진입, 테스트 무결성, 현재 후보 증거, PR·CI·승인·태그·역병합·복구.
- grill-me는 Codex managed plugin으로 전환한다. 동일한 openai-curated-remote 공급 경로를 사용한다.
  Matt Pocock 묶음 1.2.3의 grill-me/grilling만 활성화하고 나머지 33개 신규 스킬은 비활성화한다.
  기존 개별 설치는 삭제하지 않고 비활성화해 복구 가능하게 보존한다.
- 소비 프로젝트 원격·배포·결제와 Claude 인증·실제 모델 검증은 제외한다.
  이번 수정의 병합·발행·Harness 설치는 구현·검증 완료와 별도 단계다.

## 수용 기준과 확인

| ID | 기준 | 확인 |
|---|---|---|
| AC1 | 계획·신규/기존 구현·진단의 공통 계약을 한 원본으로 연결한다 | reader 경로·발견·package 검사, 독립 검토 |
| AC2 | Superpowers 절차를 다시 시작하지 않고 승인·테스트·증거 계약을 유지한다 | 원본 diff와 실패/진단/기존 변경 시나리오 검토 |
| AC3 | 공용 release-check가 소비 제품의 SVG·전용 provenance 경로를 강제하지 않는다 | 금지 경로 회귀와 repo 선언의 기존 verifier 시험 |
| AC4 | changelog는 repo 선언으로 실행하고 사용자 변경을 일괄 stage/전환하지 않는다 | 공용 명령·Git 경계 검토와 기존 태그·정리 회귀 |
| AC5 | 실행하지 않은 운영 헬스·배포·설치를 성공으로 보고하지 않는다 | 결과별 PASS/FAIL/UNVERIFIED/SKIP 계약 검토 |
| AC6 | 필수 검사 미확인·인증/네트워크 실패는 NO-GO, 실제 비적용만 SKIP이다 | fail-closed 원문과 독립 사례 판정 |
| AC7 | grill-me 배포 방식은 현재 공식 원본과 대조하고 기존 기능을 보존한다 | 제작자 manifest/ADR·로컬 원본·Codex 목록 확인 |

## 영향 문서와 검사

현재 안내: README, docs/intro.html, development-coordination, product-boundaries,
platform-overlap-audit, harness-maintenance, AGENTS와 decisions.
공통 reader: skills/ao-coordinate/project-contract.md, plan, feature-add,
feature-modify, systematic-debugging. 선택형 loop·milestone·qa의 native 연결도 대조한다.
release/release-check의 직접 소비자는 기존 changelog·external-pilot·cleanup 테스트다.
Codex wrapper·라우터의 이름·17개 일대일 전달과 package 소속을 유지한다.

새 구조 회귀는 원본의 누락·금지 명령을 먼저 확인한다. 구조 검사는 LLM 실행 준수나 의미 품질의
보장이 아니다. 기존 보호/복구·발견·package 및 CI quality 명령을 실행하고 실제 증거를 기록한다.
필수 독립 검토는 원래 요구와 현재 후보를 직접 확인하며 후보를 수정하지 않는다.

## 현재 진행

- [x] 현재 develop 65ebb2b와 설치 0.86.0, 사용자 checkout·다른 worktree 보존 확인.
- [x] 기존 문제와 직접 소비자 확인, 격리 worktree fix/skill-contract-consolidation 생성.
- [x] 통합 구현 및 repo 선언으로 전용 명령 이전.
- [x] grill-me managed 설치·활성 pair·개별 비활성, fresh discovery 오류0 확인.
- [x] 영향 회귀·전체 quality·독립 검토와 문서 현행화.
- [x] 검증한 구현을 커밋하고 다음 전달 단계에 인계.

중단 기준: 위 수용 기준을 충족한 검증 후보를 전달하면 이번 수정 작업을 종료한다.
필수 미확인은 이유와 해제 조건을 보고하며 병합·태그·설치·배포 완료로 확대하지 않는다.

## 설치 범위 증거와 한계

Superpowers와 같은 Codex plugin add·version cache·enabled 설정을 사용했다.
공급 ID는 mattpocock-skills@openai-curated-remote1.2.3이며 원본 repository는 mattpocock/skills다.
처음 조회한 제작자 ADR의 초기 Codex 보류 결론은 2026-10-07/08 추가 기록으로 대체됐다.
초기 재구성 후보 engineering-suite-grill-me2.0.0은 제거했고 Matt-author 묶음을 선택했다.
기존 config 본문은 prefix 바이트 동일, 새 plugin과 개별 skill 활성 설정만 추가했다.
새 app-server skills/list: 설치본35개 중 요청한2개 enabled, 기존 개별 disabled, errors0.
CLI가 일부 agents/openai.yaml의 CHAT 제품 값을 지원하지 않아 UI 메타데이터 경고를 출력했다.
skills/list의 발견 오류0과 UI 경고는 별개다. 스킬 발견을 UI 호환성이나 인터뷰 실행 성공으로 확대하지 않는다.
현재 열린 채팅 재로딩과 인터뷰 실제 실행은 검증하지 않았다. 설치 요청으로 인터뷰를 시작하지 않는다.
비활성 path가 cache 버전에 결박돼 있으므로 향후 plugin 업데이트 뒤 활성 범위를 다시 확인해야 한다.
현재 제작자 main1.3.1과 curated 설치1.2.3은 구분하며 cache를 임의 패치하지 않는다.

## 검증 결과와 전달 상태

- 구현 커밋8c1fe32, 변경 이력 커밋cafdadff3b4c8087399981a0c31e282ba2d699fe.
  이 clean 후보에서 현재 CI quality의 **69개 단계 모두 exit0**이다.
  로컬 macOS 재현이며 GitHub CI 실행은 아니다. PR 본문은 로컬 event로 전달했다.
  Ubuntu apt 설치는 기존 rg 확인으로, pipx 설치는 같은 ruff0.15.15 확인으로 대체했다.
- 새 구조 회귀8개, 대표 계약53개, loop30개, 문서·경로·정리45개가 통과했다.
  새 구조7개와 필수 독립 보안 검토1개의 수정 전 실패를 확인하고 수정 후 통과했다.
- 첫 독립 검토의 P2(보안 독립 검토의 조건부 전환)를 복원했다. 별도 read-only 재검토는
  원본·직접 소비자·reader/package·7개 경계 시나리오에서 구체적 차단 결함을 찾지 못했다.
  CLI 기록은 Astra/medium/read-only이며 macOS cache 쓰기 거부가 관찰됐다. 모델 identity를 따로 probe하지 않았다.
  전체 textual diff·write-producing 검사·실제 LLM 준수는 독립 검토의 확인 범위가 아니다.
- 검토 후 변경한 원문9개의 승인 checksum을 갱신하고 공통 계약·reader2개를 추가했다.
  guard·hook·agent·기존 runtime의 관련 없는 checksum은 그대로 유지했다.
- 위 후보의 package check와 검토용 bundle checksum 통과, workflow에 공통 계약 포함 확인.
  처음 checksum 명령은 잘못된 cwd로 실패했고 생성된 bundle 위치에서 재실행해 통과했다.
  산출물의 installable:false는 유지하며 독립 split 제품 공개로 보고하지 않는다.
- 사용자 primary/d1f9의 branch·HEAD·추적 파일과 전역 config의 기존 prefix 바이트를 보존했다.
- **이번 수정 범위 완료.** 원격 PR·병합·태그·Harness0.87 설치는 미실행이며 실제 설치는0.86.0이다.
  정식 release-check의 live 외부 증거 확인도 이번 로컬 수정 검증으로 대체하지 않는다.

명령별 종료 코드·로그·검토 원문·설치 발견 결과는 이번 작업 증거의
work/skills-consolidation/quality-result.json, independent-review-followup.md,
grill-installation.json, skills-after-disable.json에 보존한다.
