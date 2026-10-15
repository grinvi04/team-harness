# 문서 분류·명명·시점 정리

로컬 완료 기록: 2026-10-15 O1–O4 정리·검증 완료. 기준 후보는 `020e7ba44d2bf28bda9037248da508bd4f1c8f06`이다.
사용자가 승인한 조사 원칙을 적용한다. 기존 v1.0.0 발행·설치 완료는 이 문서 작업과 별개다.

## 목표와 경계

- 처음 쓰는 사람이 현재 안내와 과거 실행 결과를 구별하고 필요한 정본에 도달하게 한다.
- 사용자 가이드를 목적별 이름으로 모으고, 공개 경로·앵커의 실제 소비자는 유지한다.
- 현재 계약, 승인 스펙, 실행 증거, 과거 결정의 관계와 수정할 정본을 연결한다.
- AI 작성 여부로 폴더를 나누지 않는다. 생성물은 생성 정본·명령으로, 증거는 당시 후보·결과로 식별한다.
- 소비 저장소·플러그인 동작·설치·기존 보호·Git Flow·검사 기준은 유지한다. 원격 전달은 아래 후속 범위다.
- 과거 JSON·원문 로그·고정 Git blob·CHANGELOG를 다시 쓰거나 불필요하게 옮기지 않는다.
- 새 문서 프레임워크·중앙 상태 서버·전역 설정·새 기능을 추가하지 않는다.

## 순서와 완료 기준

| 단계 | 작업 | 완료 기준 |
|---|---|---|
| O1 이름·시점 | 기존 저장소/개인/팀 가이드 이름, 재설계 전 평가의 current 표현 정리 | 제목과 경로만으로 독자·목적·과거 후보 구분; 과거 결과 보존 |
| O2 분류·reader | `docs/README.md`에서 목적별 정본 연결; 사용자 가이드 묶음 이전 | README·AGENTS·직접 현재 reader가 새 정본 사용; 기존 경로/앵커 계속 도달 |
| O3 수명·보존 | 분류·명명·승격·역사 보존 기준을 기존 구조 안내에 연결 | 소유/생성/증거 구분, 중복 정본 없음, 소비자 있는 호환 파일 유지 이유 명시 |
| O4 검증 | 현재 후보의 구조·기존 품질·독립 탐색/검토 | 아래6과제와 필수 검사 통과, 미해결 차단0, 진행 기록 일치 |

정본 경로 계약이 있는 정책·설치 문서는 docs 루트에 유지하고 분류 인덱스로 찾는다.
모든 파일을 같은 시점에 옮기거나 빈 reference/design 폴더를 만들 필요는 없다.
호환 안내는 본문을 복제하지 않으며 기존 깊은 링크를 새 정본의 해당 절로 연결한다.
과거 문서의 결과를 보존한 채 시점·후속 링크를 정정한다. 시험/기록의 실제 명칭은 원문대로 둔다.

## 검사 계약

| ID | 과제 | 기대 결과 |
|---|---|---|
| N1 | README에서 설치와 기존 저장소의 개인·팀 시작 찾기 | 명령/첫 요청의 단일 정본 도달; 회사가 필수라는 오해 없음 |
| N2 | 현재 Git Flow·보호·병합 계약 찾기 | code-review 및 해당 프로젝트 계약; 과거 예외를 현재 허가로 해석하지 않음 |
| N3 | 스택 CI 수정 위치 찾기 | templates/stacks 원문과 생성 출력/명령 구별 |
| N4 | 재설계 전 평가 실패와 후속 결과 찾기 | 당시 SHA·최초 FAIL·영향 재시험·후속 재설계의 범위 구별 |
| N5 | 완료 상태 판정 | 구현/검증/병합/태그/설치 각각의 증거와 이번 로컬 범위 구분 |
| N6 | 호환 파일 판단 | 소비자·유지 이유·새 정본 확인; 이름만 보고 삭제하지 않음 |

기준/변경 후 탐색은 독립 읽기 전용 조사로 수행한다. 표본6개의 발견 가능성만 확인하며
실제 사람 효용·생산성·전사 도입·모든 환경의 보장으로 확대하지 않는다.
구조 검사는 실제 로컬 링크/앵커·소유 Markdown199줄 상한만 검증하며 내용의 진실성을 증명하지 않는다.
이전 경로/앵커와 새 정본, 실패·증거 보존은 별도로 대조하고 기존 quality 검사를 실행한다.
미실행/실패는 해당 범위로 남긴다. 로컬 재현은 원격 CI나 릴리즈 검증의 성공이 아니다.

## 진행 기록과 종료

결과는 이 스펙과 기존 `.project-map/` 현재 상태에 연결한다. 원문은 작업의 `.runtime/`에 보존한다.
O1–O4 완료 시 로컬 정리·검증을 종료한다. 커밋·PR·병합·태그·설치는 별도 전달 범위다.
Claude 실제 호스트는 기존 UNVERIFIED 보류를 유지하며 이번 필수 검사를 늘리지 않는다.

```harness-doc-sync
{
  "version": 1,
  "documents": [
    {
      "path": "README.md",
      "reason": "문서 분류와 실제 시작 정본 연결"
    },
    {
      "path": "AGENTS.md",
      "reason": "작업자가 읽는 실제 가이드 경로 이전"
    },
    {
      "path": "docs/README.md",
      "reason": "목적별 현재 정본과 기록 탐색"
    },
    {
      "path": "docs/repository-structure.md",
      "reason": "문서 수명·호환 보존 기준 연결"
    },
    {
      "path": "docs/specs/documentation-organization.md",
      "reason": "승인 범위·수용 기준·검증 판정"
    },
    {
      "path": "CONTRIBUTING.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/ai-collaboration.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/code-review.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/company-onboarding.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/developer-workflow-feature.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/developer-workflow.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/development-coordination.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/harness-maintenance.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/harness-setup.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/onboarding.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/pilots/current-evaluation-2026-10-15.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/product-boundaries.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/product-direction.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/quick-start.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/specs/workflow-maturity-current-evaluation.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/team-development-guide.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/guides/existing-repository.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/guides/feature-development.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/guides/solo-development.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/guides/team-development.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/pilots/workflow-evaluation-2026-10-15.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    },
    {
      "path": "docs/specs/workflow-evaluation-2026-10-15.md",
      "reason": "현재 reader 이전·호환 경로 또는 당시 평가 범위 보존"
    }
  ],
  "items": []
}
```

## 로컬 완료 판정 — 2026-10-15

- 가이드4개를 `guides/` 정본으로, 재설계 전 평가2개를 날짜형 명칭으로 이전했다.
  옛6경로·38앵커와 새 절 연결, 명령·요청·선언17블록 원문을 보존했다.
- 루트 문서56개를 목적별로 연결했다. 정책·설치 정본의 배포 reader 경로는 유지했다.
- Markdown350개 구조 검사·diff 검사 통과. 플러그인·템플릿·CI·기존 pilot189파일 byte 동일.
- quality74단계 로컬 재현 PASS. 최초 step3은 이 스펙의 필수 `items` 누락으로 FAIL했다.
  선언을 수정하고3–74를 통과했다. 영향 없는 준비1–2의 PASS는 재사용했으며 최초 로그도 보존했다.
  macOS에서 기존 pinned Python/Ruff·ripgrep과 새 npm 설치를 사용했다. hosted CI 성공을 뜻하지 않는다.
- 독립6과제 탐색에서 정본까지의 단계 수는 유지됐고, 재설계 전 평가의 current 오해를 해소했다.
  기존 URL만 안내1클릭이 추가된다. 실제 사람 사용성·효율의 입증은 아니다.
- 독립 Codex 읽기 전용 검토에서 조치할 결함 미발견. 실제 read-only 실행·후보 불변·임시 환경 정리를 확인했다.
- 원문은 기본 checkout의 `.runtime/documentation-organization-20261015/`에 있다.
  `quality-summary.json`, `preservation.json`, `navigation.json`, `review/result.json`과 원문 로그를 연결했다.
- 위 로컬 판정 당시에는 미커밋 후보였으며 PR·병합·태그·설치·배포는 미실행이었다.

## 후속 승인: 문서 전달 — 2026-10-15

사용자의 후속 진행 요청으로 커밋·PR·develop/main 반영을 이어간다.
작업 PR → develop 병합 확인 → `release/docs-organization-20261015`의 main PR → develop 역병합 순서다.
각 현재 후보의 독립 리뷰·필수 CI·기존 보호와 복원 확인을 유지하며 새 버전·태그·설치는 포함하지 않는다.
전달 상태의 원본은 [작업 PR 검색](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Acodex%2Fdocs-organization),
[main PR 검색](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Arelease%2Fdocs-organization-20261015),
[역병합 PR 검색](https://github.com/grinvi04/team-harness/pulls?q=is%3Apr+head%3Async%2Fbackmerge-docs-organization-20261015)이다.
종료 기준은 세 PR의 실제 MERGED·main/develop 내용 및 포함 관계·원래 보호 복원·기존 작업 보존이다.
로컬 원문은 `.runtime/documentation-organization-delivery-20261015/`, 현재 진행은 `.project-map/`에 연결한다.
