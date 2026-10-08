# 전역 설정 추가 검토 — 범위·합의된 설계·미확인 사유

이번 추가 확인 전의 보고서는 핵심 지침·모델·역할·명령 허용 규칙을 다뤘다.
MCP·플러그인 설치 등록·셸 진입부·관리 설정까지 전부 확인했다고 해석하면 범위를 과장한 것이다.
이번에 아래 범위를 읽기 전용으로 추가 확인했다. 원본 설정·설치·캐시·메모리는 변경하지 않았다.

## 추가 확인한 범위

| 대상 | 확인 내용 | 경계 |
|---|---|---|
| ~/.codex/config.toml | 24개 최상위 항목, 모델·plan/review·권한·compaction·features·MCP·plugin·marketplace·desktop·tui·hooks·shell 환경·memories | 파일 값은 실제 세션 적용값의 증명이 아님 |
| ~/.claude/settings.json | 모델·effort·auto permission·상시 허용·workflow·statusLine·plugin·출처·환경·remote control·UI | 최신 client에서 각 설정의 실제 적용은 미실행 |
| ~/.claude.json | global MCP 등록·프로젝트 설정 개수·캐시와 설정의 구분 | oauth/account 값·프로젝트 대화 내용은 출력하지 않음 |
| 시스템 관리 정책 | /etc/codex/requirements.toml에 hooks=true 존재 | 사용자 config와 별도 우선순위 |
| profile/override | Codex *.config.toml 없음, 조사한 legacy managed 및 Claude managed/local 파일 없음 | 서버/MDM 정책의 완전한 부재 증명은 아님 |
| 셸 설정·Codex alias | .zshrc/.zprofile, codex-hardened.sh 55줄과 참조 출처 | wrapper는 실행하지 않음 |
| MCP 시작 경로 | Codex 3개 등록 중 computer-use 비활성, docs/node_repl 등록; 주요 실행 파일·서비스 경로 존재 | 원격 호출·인증·연결 시험 미실행 |
| Claude GitHub MCP | github.sh가 gh에서 토큰을 가져와 npx 패키지 실행 | 인증 토큰을 가져오거나 wrapper 실행하지 않음 |
| 플러그인 등록·설치 | 설정 enabled와 cache/installed manifest version을 구분 | vendor 원본 전체 감사가 아님 |
| hook trust | 저장된 trust 항목과 구/신 경로가 함께 존재하는 구조 | hash 존재로 callback 실행을 통과 처리하지 않음 |
| statusLine | ~를 확장한 실제 경로 존재, 30줄 원본 확인 | 초기 단순 Path 확인의 false를 정정함 |
| 프로젝트 trust | 53개 저장 경로 중 현재 존재 20개 | 없어진 33개를 무조건 권한 취약점으로 분류하지 않음 |
| automation | 로컬 automations 폴더에 automation.toml 없음 | 서버/다른 호스트의 스케줄 부재는 미확인 |
| desktop host state | 관련 설정 키·선택값만 확인, cached Work 모델 선택과 Codex runtime 구분 | prompt/history/account 내용과 내부 캐시를 정본으로 삼지 않음 |

[비밀 값 제외 요약](../global-config-addendum.json), [세부 설정 구조](../global-config-detail-addendum.json), [관리·진입부·버전](../global-layer-addendum.json), [설치·범위](../global-install-addendum.json).

## G01 — Claude의 실제 Harness 설치가 0.68.0

Codex cache와 manifest는 0.81.0이다. Claude installed registry와 실제 manifest는 모두 0.68.0이며 skill 16개가 있다.
검토한 저장소의 QA 계약이 최신이라는 것과 Claude에 최신 계약이 설치됐다는 것은 다르다.
설치 manifest (`/Users/grinvi04/.claude/plugins/cache/team-harness/harness-guard/0.68.0/.claude-plugin/plugin.json`, 당시 로컬 원본).
향후 수정 시 client 지원과 Harness 설치·실제 로딩을 별도 확인해야 한다. 이번에 업데이트·설치하지 않았다.

## G02 — 자동 메모리 생성과 기록 보관 지침

Codex config (`/Users/grinvi04/.codex/config.toml`, 당시 로컬 원본)의 features.memories, memories.generate_memories, use_memories는 true다.
공통 지침은 프로젝트 상태·결정·백로그를 프로젝트에 두라고 요구한다. 자동 생성기가 이 구분을 지킨다는 실행 증거는 없다.
합의된 설계: 새 대화를 자동 메모리 생성 입력으로 넣지 않고 기존 기억 조회는 유지한다. 개인 습관의 새 기록은 명시적 요청 범위를 따른다.
[공식 옵션](https://learn.chatgpt.com/docs/config-file/config-reference)은 generate_memories=false를 새 대화의 생성 입력 중단으로 설명한다.
이 값만으로 기존 대화·대기 중 작업의 생성까지 모두 중단한다고 보장하지 않는다. 기존 기억을 임의 삭제하지 않는다.

## G03 — Claude에도 보호 승인 조건의 상시 허용이 남아 있다

사용자 설정 (`/Users/grinvi04/.claude/settings.json`, 당시 로컬 원본)의 permissions에는 gh pr merge와 repos/grinvi04/*의 리뷰 승인 조건 DELETE/PATCH 패턴이 있다.
defaultMode는 auto이고 skipAutoPermissionPrompt는 true다. 파일 값만으로 모든 명령이 실제 자동 실행된다고 주장하지 않는다.
과거 특정 PR의 일회성 해제·복원 승인을 모든 저장소·브랜치의 상시 실행 권한으로 확대해서는 안 된다.
일상 작업의 자동 진행은 유지하되 위험한 원격 변경의 정확한 대상·승인·복구 경계를 다시 연결하는 것이 적절하다. 이번에 규칙을 철회하지 않았다.

## G04 — 셸의 Codex 시작 경로에는 추가 동작이 있다

alias codex는 주 저장소의 wrapper (`/Users/grinvi04/team-harness/scripts/codex-hardened.sh`, 당시 로컬 원본)를 호출한다.
이 wrapper는 검토 worktree의 같은 파일과 바이트가 같다. 주 저장소 HEAD는 f7aa616774b2de315674981b2ab22934414ad1c9이며 깨끗하다.
바이너리 신뢰 검사 후 plugin cache 동기화·검사·security-guidance patch를 수행하고 실제 Codex로 인수를 전달한다.
명시 모델 인수를 고정값으로 덮어쓰거나 sandbox/hook trust bypass flag를 쓰는 코드는 확인되지 않았다.
그러나 CLI 시작 시 cache/config 쓰기 가능성이 있으므로 파일을 읽는 검토와 해당 wrapper를 실행하는 시험을 구분해야 한다.

## G05 — 저장된 허용·UI 선택과 이번 세션 적용값

config의 approvals_reviewer는 user지만 이번 세션은 호스트가 auto_review를 제공한다. 사용자 파일 하나로 최종 적용을 설명할 수 없다.
desktop에는 full access 확인 안내 생략 값이 있다. 이 UI 값으로 현재 세션이 full access라고 판정하지 않는다. 현재 세션은 workspace-write다.
[설정 우선순위](https://learn.chatgpt.com/docs/config-file/config-reference), [Claude 우선순위](https://code.claude.com/docs/en/settings)를 적용하며 실제 session override와 구분한다.

## G06 — 정리·재평가할 설정

현재 존재하지 않는 trusted path 33개는 정리 후보지만 사용자 경로·다른 호스트·재생성 가능성을 확인한 뒤 처리한다.
GitHub MCP는 버전 고정 없는 npx -y 패키지를 시작한다. 설치/재현성·권한 경계를 검토할 대상이며 실제 악성 실행 증거는 아니다.
220,000 token/total의 고정 compaction 설정은 모델별 기본값과 비교할 성능 가설이다. 측정 없이 오류라고 분류하거나 임의 변경하지 않는다.
font/theme·notifications·sleep·remote control·네트워크 값은 기존 취향과 실행 요구를 보존한다. 새로운 결제·로그인·OS 정책 변경은 없다.

## 사용자가 선택한 설계 방향

2026-10-09 사용자가 두 질문 모두 권고안을 선택했다.

1. 전역 기본 모델의 설계 방향: 평소 Sol 6.1, 중요한 판단과 독립 검증 Astra. 모든 기존 역할 모델·effort는 최신 공식 지침과 과제 기준으로 다시 선정한다.
2. 메모리: 새 대화를 자동 메모리 생성 입력에서 제외하고 기존 기억 조회는 유지한다. 기존 기억의 삭제는 포함하지 않는다.

두 질문은 설계 선호만 받았으며 실제 설정 수정 승인은 아니라고 명시했다. 이번 선택으로 원본 설정을 바꾸지 않는다.
추가 지시: 현재 명시 모델·effort를 기준으로 삼지 않는다. 오래된 저장값과 새 작업에서의 구체적 사용자 선택을 구분한다.
Claude 강제 훅·Codex 고정 역할까지 포함한 새 배정 후보와 적용 순서는 [모델 검토](05-model-global.md)에 모았다.
문서의 199줄·대상 범위·핵심 진입점·QA 판정·배포 제외는 기존 지시를 따른다. 파일 이름·계층·parser 이관은 별도 사용자 지정이 필요하지 않다.

## 미확인의 뜻과 분류 정정

미확인은 실패 판정이 아니라 주장에 필요한 실행 증거가 없다는 뜻이다. 반례로 확인한 결함과 별도로 관리한다.
이전 문구는 미실행 시험·선행 조건·제외 범위를 함께 묶었다. 모든 항목이 승인 부족 때문에 막힌 것은 아니다.
안전한 읽기 전용으로 가능한 동일 과제 비교 중 Codex 세 설정은 이후 실행했다. [추가 실행](10-agent-owned-execution.md)과 남은 역할/host 검증을 구분한다.
따라서 파일 검토와 기존 시험 재현을 완료했다는 표현을 모든 실제 동작 검증 완료로 확대하면 안 된다.

| 분류 | 항목 | 확인한 것과 미확인 사유 | 필요한 증거·재개 조건 |
|---|---|---|---|
| 남은 검증 | 새 앱/CLI 세션의 hook 실행·필수 지침 전달·최종 설정 | 직접 가드 시험·정의·신뢰 설정은 확인했으나 실제 호스트가 해당 도구 호출을 가로챘다는 증거는 없다. 셸 wrapper는 cache/config를 쓸 수 있어 원본 환경에서 실행하지 않았다. | 임시 설정·프로젝트에서 정상/거부 호출과 hook 로그·실제 적용값을 확인한다. 격리 시험으로 증명하지 못한 기존 앱 세션은 별도로 남긴다. |
| 선행 조건 + 남은 검증 | 최신 Claude 모델·effort·Harness 로딩 | CLI 2.1.267은 확인한 최신 모델 최소 지원 버전보다 낮고 Harness 설치는 0.68.0이다. alias와 저장된 high만으로 최신 모델·effort·최신 계약을 증명하지 못한다. | 지원 client와 plugin 후보를 확보한 뒤 실제 모델·effort·로딩을 확인한다. 원본 업그레이드/설치는 실제 수정 범위가 승인될 때 수행한다. |
| 남은 검증 | 모델별 같은 과제의 품질·사용량 비교 | 역할 설정과 독립 검토 호출은 확인했다. 이후 Luna/xhigh·Sol 6.1/medium·Astra/medium의 같은 입력 비교를 실행했다. 전체 역할·구현·Claude 비교와 과제별 청구 금액은 아직 확보하지 않았다. | 기존 배정 대신 최신 공식 권고와 작업 위험에서 후보를 정하고, 원본을 쓰지 않는 같은 과제·같은 권한으로 오류·누락·재작업·시간·사용량을 기록한다. 실제 측정 전에는 설계 방향을 최적 조합이라고 단정하지 않는다. |
| 남은 검증 | MCP 연결·인증의 실제 유효성 | 등록·시작 경로·파일 존재는 확인했다. 공식 docs MCP의 실제 검색·본문 조회는 성공했다. 다른 등록 서버 전체의 연결 시험은 하지 않았고 인증 실패로 단정하지 않는다. | 현재 가능한 읽기 전용 상태/도구 호출부터 시험한다. Claude GitHub wrapper는 토큰 전달과 버전 미고정 npx 실행이 있으므로 일반 파일 읽기와 구분한다. 로그인·설치·외부 쓰기가 필요한 경우 정확한 조건을 남긴다. |
| 적용 후 검증 | 합의된 메모리 옵션의 실제 동작 | 현재 true는 확인했다. 제안한 false는 아직 적용하지 않았으므로 새 대화의 생성 입력 제외는 검증할 후보 자체가 없다. | 실제 수정 승인 후 옵션과 새 대화 적용을 확인한다. 기존 대화·대기 중 생성 작업까지 모두 중단하거나 기존 기억이 삭제된다고 보장하지 않는다. |
| 남은 검증 | workflow DSL 활성화와 실제 리뷰 판정 | 원본과 순수 판정 함수의 문제는 확인했다. 현재 플랫폼에서 workflow 전체를 실제 호출하지 않았다. | 격리 과제에서 확인·기각·미확인 결과와 실제 활성화를 대조한다. 함수 결과를 전체 workflow 실행 증거로 취급하지 않는다. |
| 미확인 지원 계약 | PR base를 원자적으로 비교하는 공식 지원 | gh의 head 고정 옵션은 확인했다. base를 함께 원자적으로 고정하는 공식 지원은 확보하지 못했다. | 최신 공식 API/명령 계약과 안전한 모의 경합 시험을 대조한다. 지원이 없으면 재검사·서버 보호가 남기는 경합 한계를 설계에 명시한다. |
| 후속 구현 검증 | 새 GitHub CI·패키지 설치·생성 자산·지도 서비스 갱신 | 현재 quality 63단계·패키지 계약·현재 그림·지도 parser를 시험했다. 새 수정 후보·발행·서비스 변경은 아직 없다. | 수정 후보가 생기면 영향 시험·필수 CI·설치/로딩·생성 결과를 검증한다. 임시 출력으로 가능한 시험은 원본 발행·재시작과 구분해 수행한다. |

기존 시험 63단계 통과는 위 남은 실행 검증을 통과로 바꾸지 않는다.
원본을 변경하지 않는다는 조건이 모든 동작 시험을 금지하는 것은 아니다. 안전한 시험은 제가 수행할 남은 작업이다.
모델 사용량·시간을 실제 금액으로 환산하려면 계정의 비용 구조가 별도로 필요하다. 구독 한도 비율을 과제별 비용처럼 보고하지 않는다.

## 이번 검토에서 제외한 실행과 자료

| 대상 | 제외 이유 | 이번 검토에서 확인한 범위·후속 조건 |
|---|---|---|
| 실제 GitHub 보호 변경·복구·PR 병합·태그·marketplace 발행 | 실제 원격 상태를 변경하며 이번 수정 전 검토에는 포함되지 않음 | 실제 보호 설정은 GET으로 확인했다. 실패/복구 문제는 가짜 API로 재현했다. 실제 쓰기는 대상·승인·복구 범위가 정해진 후 수행한다. |
| 운영 DB 파괴·실제 비밀 전송·로컬 파괴 명령 | 운영 위험을 만드는 실행은 검사기의 반례 확인에 필요하지 않음 | 입력 문자열·격리 fixture로 검사 동작을 확인했다. 폐기 가능한 환경의 통합 시험과 운영 파괴 실행을 구분한다. |
| 소비 앱 전체 기능 QA·운영 화면·배포 | 이번 범위는 Harness·전역 설정·문서와 직접 소비자의 검토이며 배포는 사용자가 제외함 | 관련 코드·명령·지침을 대조했다. 향후 변경의 영향 QA는 필요하며 기존 앱 전체 PASS나 배포 완료를 주장하지 않는다. |
| 서버 계정 정책·MDM·다른 호스트 스케줄의 전수 확인 | 로컬 파일만으로 서버 관리 상태를 전부 조회할 수 없음 | 로컬 관리 파일과 세션 override는 확인했다. 외부 관리 상태가 필요한 판단에서는 공식 조회 수단이 확보될 때 별도 확인한다. |
| 제3자 plugin 코드 전체·OS 모든 설정·인증정보 내용 | 사용자 관리 AI 설정 검토와 다른 범위이며 인증값 수집은 불필요함 | plugin 등록·manifest·설정·시작 경로만 확인했다. 인증정보의 내용을 읽거나 출력하지 않았고 제3자 전체 안전성을 보장하지 않는다. |

제외 항목은 이번 검토의 필수 UNVERIFIED로 세지 않는다. 별도 범위의 완료 여부는 주장하지 않는다.
자동 생성 캐시·runtime 상태를 사용자 관리 원본처럼 직접 편집하지 않는다.

[업데이트에 따른 폐기·축소·유지 검토](07-deprecation-removal.md)에 실제 호출되는 제거 후보와 최신 지원을 더 확인할 Claude 설정 키를 구분했다.

사용자의 앱 업데이트 이후 [실행 환경 추가 확인](08-execution-environment.md)을 연결했다. 앱 내장 Codex의 앞선 관찰은 0.162.0-alpha.2다.
터미널 Codex는 이후 사용자 업데이트를 실제 재확인해 0.161.0이다. 초기 0.156.1과 최신 [원본 증거](../planning-source-state.json)를 구분한다.
PATH의 Claude Code 2.1.267 관찰은 데스크톱 앱 내부 실행 버전·지원 모델을 확정하지 않는다. 이전 CLI 한계를 앱 전체의 한계로 확대하지 않는다.
추가 원본 대조에서 Codex config digest가 이전 감사와 달라졌으며 관련 모델·effort·메모리 값은 다시 확인했다. 이전 전체 파일 상태를 현재와 같다고 단정하지 않는다.
