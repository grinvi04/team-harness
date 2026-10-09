# Harness 현대화 — 승인된 실행과 완료 기준

2026-10-09: 사용자가 전체 승인 작업 종료까지 실행하도록 승인했다. 작업 브랜치 `fix/harness-modernization`.
시작 후보 `980fe87b4429e601e7f95155063eb2c28906fbaf`. 기존 사용자 `.gitignore` 변경은 보존한다.
당시 감사·실패·모델 표본은 [역사 보고서](harness-modernization/review/REVIEW.md)에 보존했다.
현재 실행의 정본은 이 스펙과 아래 단계다. 역사 보고서의 ‘수정 전’은 당시 상태다.

## 목표·범위

확인된 안전·QA 판정 결함을 고치고 최신 공식 지원과 실제 품질로 모델·effort·역할·전역 설정을 선정한다.
전역 지침·Harness·ERP/siku/webhook-service/DriveTree의 사용자 소유 MD는 빈 줄/frontmatter 포함 ≤199줄이다.
의미 단위 분류·필수 읽기·정본·직접 reader와 생성기를 함께 이전하며 줄 수만 맞춘 압축은 하지 않는다.
기존 메모리 조회·사용자 취향·과거 후보와 실패는 보존한다. 새 대화의 메모리 생성 입력만 중단한다.
배포·운영 데이터·결제·새 계정·외부 plugin cache 수동 수정·관련 없는 소비 앱 기능은 제외한다.
소유 분류: 공통 GitHub 정책/증거 검사는 Harness, 로딩/권한/모델 선택의 실행은 플랫폼, 도메인 구현은 소비 제품.

## 실행과 확인

각 변경에서 원래 반례 RED → 최소 수정 → 정상/실패/경계 및 직접 소비자 → 관련 문서 갱신을 연결한다.
증거에는 후보 바이트/diff·명령·cwd·환경·최초/최종 결과를 남긴다. 이전 63 PASS를 수정 후보에 옮기지 않는다.
전역 실제 적용 전 대상 digest·부분 실패/복구·동시 변경 보존·혼합 버전 지원 조합을 시험한다.
독립 검토는 다른 인스턴스가 수행하며 실제 읽기 전용 제한을 확인한다. 행동 약속을 권한 강제로 보고하지 않는다.
모든 필수 PASS·차단 결함 0·현재 문서 일치·독립 검토·필요한 실제 적용을 충족해야 해당 단계가 완료다.
변경·drift가 없는 증거는 재사용한다. 실제 비적용만 SKIP, 실행 못 한 필수는 UNVERIFIED다.

### Task 1: 안전 검사와 후보 경계

상태: in progress. [세부 계획·AC-S1–S5](harness-modernization/plan/01-safety.md).
조회 실패의 보호 쓰기 0, 위험 입력 차단과 정상 유지, DDL 구문, 바이너리/원본/출력 연결, 경로 실행을 확인한다.
필수 시험은 각 묶음 계획에 연결했다. 실제 위험 명령·네트워크 전송·운영 DB는 실행하지 않는다.

### Task 2: QA·리뷰·복구·태그 판정

상태: in progress. [세부 계획·AC-Q1–Q5](harness-modernization/plan/02-qa-delivery.md).
실패/빈 실행/uncertain이 PASS로 숨겨지지 않고 PR head·새 thread·복원 정책·merge SHA·생성 결과가 정확해야 한다.

### Task 3: 모델·전역 설정·native 대체

상태: in progress. [세부 계획·AC-M1–M6](harness-modernization/plan/03-model-global.md).
Sol 6.1 일반 작업·Astra 중요 판단의 합의에서 지원/권한/같은 과제 품질·총사용량을 확인하고 실제 역할을 선정한다.
Claude 최신 지원 실행기·강제 hook 제거/기본값·cache 대체·새 대화 메모리 입력·안전한 적용/복구를 함께 확인한다.

### Task 4: MD 구조와 직접 소비자

상태: in progress. [세부 계획·AC-D1–D6](harness-modernization/plan/04-docs-consumers.md).
소유 목록 전체의 199줄·내용/역사·생성 결정성·package/reference·지도 parser·4개 소비 지침과 실제 명령을 확인한다.
특정 제품 문제를 공용 Harness 기능으로 올리지 않고 최소 문서/직접 reader 변경으로 정렬한다.

### Task 5: 통합 인수·기록·전달·정리

상태: in progress. [세부 계획](harness-modernization/plan/05-acceptance.md).
현재 후보 전체 quality/필수 검사·독립 보안/권한 검토·문서 현행화·실제 설치/새 세션을 구분해 확인한다.
원격 전달은 기존 wrapper/CI/리뷰 계약을 따른다. 새 보호 예외는 과거 PR의 승인을 재사용하지 않는다.
사용자 자료·보류 후보를 보존하고 작업 소유 worktree만 정리한다. 제외한 배포를 종료 조건으로 추가하지 않는다.

## 진행 기록

- 2026-10-09: 실행 승인·분리 브랜치·역사 증거 이관. 전역 설정과 소비 원본은 아직 적용 전.
- 권한 제약: native 협업 역할의 read-only 선언과 실행 workspace-write 차이를 보존했다. 지원 실행 경로에서 실제 차단을 확인한다.
- 현재 안내·진행 갱신 대상: 이 스펙/단계 문서, 관련 표준·caller·consumer 문서, `.project-map/`.
- raw 실행 기록은 이 스펙 소유 실행 공간에 저장하고 완료 때 필요한 증거만 후보와 함께 보존한다.

- 2026-10-09: 1A/1B/1C/1E의 영향 시험 및 2E 생성기 시험 통과. 1D·2A·2B·2C 영향 시험 통과; 2D 진행 중. 전체 인수·실제 적용·발행은 남아 있다.
- 2026-10-09: 2C의 설정 적용/실패와 단언 감소 시험 통과. count-only gate와 실행 QA의 역할을 구분해 완료 기준을 명확히 했다.

- 2026-10-09: Claude 터미널을 공식 update로 2.1.295로 갱신했다. 최신 모델 호출·effort·실제 앱 실행 확인은 별도 진행 중.

- 2026-10-09: 2D uncertain/coverage 판정, 3E 자동 cache patch 축소, 4B/C 의미 단위 분리와 generator/reader 후보 검증을 진행했다. 전체 gate는 별도 확인한다.
- 2026-10-09: Claude 첫 최신 모델 호출은 OAuth 만료로 실패했다. 사용자의 ‘나중에 갱신’에 따라 실제 Claude 모델·상속·권한·품질/사용량 비교는 보류한다. 강제 hook 제거와 native 정의의 정적/fixture 결과를 실제 호출 PASS로 바꾸지 않는다.
- 2026-10-09: 전역 15개 파일 실제 적용 완료. 공통 원본·두 진입점은 동일 본문 154줄이다. 적용 도구의 실패·복구·동시 변경 fixture 24건과 별도 읽기 전용 검토를 통과했다. 새 Codex 역할 호출과 공식 plugin 설치는 별도 검증 중이다.
- 2026-10-09: 권한 규칙 26개는 실제 native 정책 평가에서 prompt였다. 명령을 실행한 결과가 아니다. GitHub MCP wrapper의 버전 고정도 유지 지원·실제 MCP 성공을 증명하지 않는다. [전역 적용 기록](harness-modernization/execution-m3f.json).

- 2026-10-09: Codex 여섯 역할의 모델/medium을 실제 확인했다. 쓰기 부모 아래 read-only 역할의 workspace-write 반례를 보존하고 별도 read-only 부모의 다섯 자식 policy를 확인했다. 새 역할 실행이 추가한 임시 trust 한 개만 제거했다.
- 2026-10-09: 공용 skill effort override 12개를 제거하고 본문/QA를 유지했다. 실제 workflow 비교에서는 두 후보 모두 잠긴 11개 회귀를 통과했으며 시간/사용량과 ephemeral metadata 한계를 별도 기록했다.
- 2026-10-09: 네 소비 프로젝트 문서 원본 적용·필수 로컬 검사·각 local commit을 완료했다. 새 원격 push/PR와 배포는 하지 않았다. [소비 적용 증거](harness-modernization/execution-consumer-apply.json).
- 2026-10-09: `fc05d31` 독립 읽기 전용 검토에서 폼 파일 옵션·자동 CI fallback·누락 QA 상태 결함 3건을 확인했다. 각각 RED를 보존하고 수정·직접 회귀를 통과했다. 수정 후보의 통합 재검토와 최종 gate는 진행 중이다. [검토와 수정](harness-modernization/execution-integrated-review.json).
- 앞의 모델 표본 두 후보도 새 누락 상태 경계에서 11 PASS/1 FAIL이었다. 당시 11개 기준의 시간·사용량을 현재 전체 품질 통과로 확대하지 않는다.
- 공식 CLI의 격리 plugin 설치 3종은 `fc05d31`의 내용·목록만 확인했다. 이후 guard·merge 수정은 새 설치 후보로 다시 확인하며 실제 dispatch·원본 설치·발행은 별도 단계다.

## 이 변경의 문서 동기화 범위

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "docs/specs/harness-modernization.md",
      "reason": "승인 범위·현재 실행·보류·완료 기준 정본"
    },
    {
      "path": "docs/specs/develop-auto-merge.md",
      "reason": "자동 필수 CI 조회 실패 거부와 수동 fallback 보장 한계"
    },
    {
      "path": "docs/code-review.md",
      "reason": "현재 자동/수동 CI 판정 계약"
    },
    {
      "path": "docs/specs/harness-modernization/plan/03-model-global.md",
      "reason": "설정 적용과 사용자 보류된 실제 Claude 검증 구분"
    },
    {
      "path": "docs/specs/harness-modernization/plan/04-docs-consumers.md",
      "reason": "199줄·reader·generator·소비 원본 단계 대조"
    },
    {
      "path": "docs/specs/harness-modernization/plan/05-acceptance.md",
      "reason": "전체 gate·독립 검토·전달·정리의 미완료 경계"
    },
    {
      "path": "docs/model-tiering.md",
      "reason": "native 모델/effort·현재 전역 적용·실제 호출 한계"
    },
    {
      "path": "docs/platform-overlap-audit.md",
      "reason": "현재 hook 목록 및 이전 강제 hook 제거 이력"
    },
    {
      "path": "docs/harness-maintenance.md",
      "reason": "changelog 전체 계층 생성 명령과 source 버전"
    },
    {
      "path": "README.md",
      "reason": "0.82.0 후보 및 의미 단위 문서 진입점"
    },
    {
      "path": "docs/harness-setup.md",
      "reason": "공식 설치·업데이트와 명시 cache patch 경계"
    },
    {
      "path": "docs/harness-architecture.md",
      "reason": "현재 native 경로와 역사 그림의 한계"
    },
    {
      "path": "docs/pilots/consumer-readiness-2026-10-07.md",
      "reason": "날짜 고정 원본과 분리된 evidence reader 경로"
    },
    {
      "path": "docs/api-standards.md",
      "reason": "CSV 및 OpenAPI·실제 시험 한계"
    },
    {
      "path": "docs/db-standards.md",
      "reason": "금액 정밀도 계약과 기술적 보장 경계"
    },
    {
      "path": "docs/ai-collaboration.md",
      "reason": "현재 안내와 실제 읽기 경로"
    },
    {
      "path": "docs/decisions.md",
      "reason": "현재/역사 결정 진입점"
    },
    {
      "path": "docs/developer-workflow.md",
      "reason": "필수 feature 상세 읽기 경로"
    },
    {
      "path": "docs/product-direction.md",
      "reason": "현재 제품 방향과 역사 로드맵 읽기 경로"
    },
    {
      "path": "docs/operations.md",
      "reason": "보안 사고 상세 읽기 경로"
    },
    {
      "path": "CHANGELOG.md",
      "reason": "Git 기반 생성된 전체 release index"
    },
    {
      "path": "plugins/harness-guard/skills/loop/SKILL.md",
      "reason": "필수 iteration/completion/reference 읽기 경로"
    },
    {
      "path": "plugins/harness-guard/skills/milestone/SKILL.md",
      "reason": "원래 AC와 duplicate/cancel 판정"
    },
    {
      "path": "plugins/harness-guard/skills/repo-sync/SKILL.md",
      "reason": "MISSING0을 전체 drift 없음으로 오판하지 않음"
    }
  ],
  "items": []
}
```
