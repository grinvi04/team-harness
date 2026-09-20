# Agent Orchestration 통합

상태: 구현 중. 2026-09-20 사용자가 Team Harness 통합과 관련 Markdown 갱신을 승인했다. 별도 설계 승인 대기를 반복하지 않는다.

## 목표와 경계

개발 요청의 정리·필요한 위임·인계·재개를 Team Harness의 선택 workflow로 제공한다. 정책·기술 기준과 사용자 진입점은 Team Harness가 소유하고 제품별 코드·상태는 제품 저장소가 소유한다. 판정은 **연결**이다. native 실행·권한 엔진이나 회사 정책을 새로 만들지 않는다.

이관 원본: agent-orchestration commit `4004bd4c7409acf45d7f3c4a15f228d6735ac89a`. Team Harness 시작점은 develop `9572066`; 기존 별도 작업 브랜치는 변경하지 않는다.

## 수용 기준

| ID | 동작·완료 기준 | 검증 |
| --- | --- | --- |
| AC1 | ao-coordinate가 선택 workflow로 발견되고 Codex wrapper가 공통 원본에 연결됨. 정책·runtime 역할 배치 중복 없음 | skill·catalog·boundary·native mapping 검사 |
| AC2 | schema·4개 검사기의 기존 계약과 거부 사례 보존 | 기존 선언 검사 테스트 364개 그대로 실행 |
| AC3 | 요청 기록 CLI는 제품 Git 루트에 DRAFT만 생성하고, 기존 파일·위험 경로·중복을 거부. 역할·스킬·전역 설정 설치 없음 | 정상·다른 cwd·공백 경로·중복·symlink·요청 보존 시험 |
| AC4 | core-only에서 조정 기능이 필수가 아니며 기존 정책·권한·리뷰·CI gate 불변 | 기존 전체 quality 검사, package build·profile 검사 |
| AC5 | 현재 문서의 기준은 Team Harness 한곳이고 이전 저장소는 명확한 이관 안내 제공 | 관련 Markdown·참조·버전·계약 일관성 점검 |
| AC6 | team-task-board의 기존 앱·기록을 보존하며 중복 역할 설치를 제거하고 통합 도구 경로 확인 | 이전 설치의 보존 검사 제거, 새 로컬 패키지·선언 검사·기록/재개 확인 |

## 구현 선택

- `plugins/harness-guard/skills/ao-coordinate/`: 공통 workflow와 재사용 계약 참조. Codex 전달은 기존 wrapper 방식이며 새 agent profile을 배포하지 않는다.
- `plugins/harness-guard/tools/orchestration/`: schema·검사기·잠긴 npm 의존성과 기존 회귀 테스트. 고급 선언 검사가 필요한 제품의 선택형 개발 도구다. 기본 조정에는 별도 npm 설치를 강제하지 않는다.
- 기존 ao-project의 역할/skill 파일 설치는 이관하지 않는다. 통합 CLI는 작업 기록 생성만 담당한다. 예전 설치 제거는 기존 버전의 remove로 내용 보존을 확인한 후 수행한다.
- 현재 유효한 계약만 이관하며 종료 실험·원시 자료·이전 태그와 이력은 원래 저장소에 보존한다. 역사 문서를 현재 계획으로 복사하지 않는다.
- Jev·전역 설정·운영·클라우드·공개 배포·새 runtime 실험은 비목표다. 일반 위임 조건과 과거 D-013 한 건의 한계는 유지한다.

## 작업 순서와 상태

1. 계약·도구 이관과 기록 CLI 검사 → AC2·AC3.
2. 선택 skill·catalog·버전·CI 연결 → AC1·AC4.
3. 관련 문서와 원래 저장소 이관 안내 → AC5.
4. 제품의 로컬 연결, 전체 검사와 독립 검토 → AC6와 전체 기준.

구현과 고정 후보 검사 결과는 이 스펙의 완료 기록 및 Git 이력에 남긴다. Team Harness의 PR·리뷰 절차를 그대로 사용하며 로컬 구현 완료를 원격 머지·배포 완료로 보고하지 않는다.

## 구현 중 확인한 결과

- 2026-09-20: 기존 선언 검사 소스·schema·364개 테스트를 이관했다. 새 DRAFT-only CLI 8개 테스트는 이전 설치 의존 코드에서 6개 assertion 실패·2개 기존 거부 통과, 구현 후 전체 8개 통과했다.
- 독립 임시 패키지에서 `npm ci --ignore-scripts`, 총 372개 테스트, check, tgz 설치, 네 CLI 정상·stale 거부·인자 오류와 DRAFT 생성을 확인했다. 로딩·권한 집행 시험은 아니다.
- package builder는 커밋된 HEAD를 검사하므로 통합 후보를 먼저 커밋한 뒤 전체 package/profile/CI 회귀를 수행한다. 결과가 나오기 전 릴리즈·통합 완료로 판정하지 않는다.

- 전체 품질 1차: 59개 단계 중 53개 통과. 새 skill inventory·호환성 표·CHANGELOG·이관 문서의 개인 경로·self-repo의 하위 tool 스택 오탐을 보완한다. package build의 작업 상태 비교는 다른 fixture 테스트의 일시 쓰기와 겹쳐 실패했으므로 단독 재실행한다.
- self-repo 기존 테스트는 새 모듈이 앱 스택으로 오인돼 실패했다. 정확한 bundled tool 경로만 self-check에서 제외하고 소비 repo의 같은 경로는 계속 탐지한다. 신규 소비자 테스트 초안의 exit 1 가정은 기존 룰 누락 WARN/exit 0 계약과 달라 원본과 대조해 수정했으며, 실제 TypeScript 탐지·규칙 점검 단언은 유지했다.

- 독립 검토(b356525)에서 구 소유권 문구, 소개 페이지 16종 잔재, 공백 ROOT 회귀와 공개 subpath API 검사의 누락을 발견해 보완했다. 상세 증거와 맞지 않는 합성 시나리오 사본은 새 배포에서 제외하고 원본 보존 저장소에 남겼다. 테스트는 공백 경로와 실제 공개 import 계약을 더 강하게 확인하도록 확장했다. 기존 v0.61.0 태그의 16개 실측 증거는 역사적 검사이므로 바꾸지 않는다.
