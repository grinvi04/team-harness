# Harness 현대화 — 승인된 실행과 완료 기준

2026-10-09: 전체 승인 작업 종료까지 실행한다. 기능 PR #506·main PR #507 병합, v0.82.0 발행·실제 설치/지도 연결을 확인했다.
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

상태: 승인 범위 VERIFIED. [세부 계획·AC-S1–S5](harness-modernization/plan/01-safety.md).
조회 실패의 보호 쓰기 0, 위험 입력 차단과 정상 유지, DDL 구문, 바이너리/원본/출력 연결, 경로 실행을 확인한다.
필수 시험은 각 묶음 계획에 연결했다. 실제 위험 명령·네트워크 전송·운영 DB는 실행하지 않는다.

### Task 2: QA·리뷰·복구·태그 판정

상태: 승인 범위 VERIFIED. [세부 계획·AC-Q1–Q5](harness-modernization/plan/02-qa-delivery.md).
실패/빈 실행/uncertain이 PASS로 숨겨지지 않고 PR head·새 thread·복원 정책·merge SHA·생성 결과가 정확해야 한다.

### Task 3: 모델·전역 설정·native 대체

상태: 설정·정적 설치/Codex 실행 VERIFIED; Claude 실제 호출 USER-DEFERRED. [세부 계획·AC-M1–M6](harness-modernization/plan/03-model-global.md).
Sol 6.1 일반 작업·Astra 중요 판단의 합의에서 지원/권한/같은 과제 품질·총사용량을 확인하고 실제 역할을 선정한다.
Claude 최신 지원 실행기·강제 hook 제거/기본값·cache 대체·새 대화 메모리 입력·안전한 적용/복구를 함께 확인한다.

### Task 4: MD 구조와 직접 소비자

상태: 문서·생성기·소비 지침/reader 실제 연결 VERIFIED. [세부 계획·AC-D1–D6](harness-modernization/plan/04-docs-consumers.md).
소유 목록 전체의 199줄·내용/역사·생성 결정성·package/reference·지도 parser·4개 소비 지침과 실제 명령을 확인한다.
특정 제품 문제를 공용 Harness 기능으로 올리지 않고 최소 문서/직접 reader 변경으로 정렬한다.

### Task 5: 통합 인수·기록·전달·정리

상태: in progress. [세부 계획](harness-modernization/plan/05-acceptance.md).
현재 후보 전체 quality/필수 검사·독립 보안/권한 검토·문서 현행화·실제 설치/새 세션을 구분해 확인한다.
원격 전달은 기존 wrapper/CI/리뷰 계약을 따른다. 새 보호 예외는 과거 PR의 승인을 재사용하지 않는다.
사용자 자료·보류 후보를 보존하고 작업 소유 worktree만 정리한다. 제외한 배포를 종료 조건으로 추가하지 않는다.

## 현재 진행

소스 독립 검토·로컬 영향 시험·세 CLI 격리 설치와 PR #506 필수 CI 5개를 통과해 develop에 병합했다.
[전달 기록](harness-modernization/execution-delivery.json)의 현재 후보로 release-check와 79파일 bundle/checksum을 통과했다.
main PR #507의 CI5개·승인·원자 병합/보호 전체 복원과 정확한 병합 SHA 태그 발행을 확인했다.
Codex/Claude 공식 설치66파일 일치, 새 Codex 스킬/세 합성 가드 거부, 실제 지도218검사·정본 연결을 확인했다.
develop 역병합·최종 증거/지도 보존·worktree 정리는 진행 중이다. Claude 추론과 열린 앱 재로딩은 완료로 주장하지 않는다.
당시 실패와 적용 순서는 [실행 기록](harness-modernization/execution-progress.md)에서 보존한다.

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
      "path": "docs/specs/harness-modernization/execution-progress.md",
      "reason": "실행 순서·최초 실패·현행 결과와 한계"
    },
    {
      "path": "docs/specs/harness-modernization/plan/01-safety.md",
      "reason": "반례 수정과 공개 증거 경로"
    },
    {
      "path": "docs/specs/harness-modernization/plan/02-qa-delivery.md",
      "reason": "자동머지·QA 상태 반례와 공개 증거 경로"
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

2026-10-09: 공식 GitHub MCP2.0.2의 독립 검토·해시 고정 설치·조회 래퍼 적용·실제 공개 README 읽기를 확인했다. Claude 추론과 열린 앱 연결 재로딩은 미확인이다.
