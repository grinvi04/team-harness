# 문서 찾기와 관리 기준

처음 사용하는 사람은 **시작·업무 가이드**, 코드를 바꾸는 사람은 **현재 계약·정본**부터 읽는다.
`specs/`의 승인 계획과 `pilots/`의 실행 기록은 해당 후보의 근거다. 최신 사용법으로 간주하지 않는다.

## 시작·업무 가이드

| 하려는 일 | 읽을 정본 |
|---|---|
| 설치·갱신·지원 환경 확인 | [설치](harness-setup.md), [지원 환경](support.md), [English quick start](quick-start.md) |
| 기존 저장소에서 시작 | [필요한 구성만 연결](guides/existing-repository.md) |
| 새 저장소 연결 | [온보딩](onboarding.md) |
| 혼자 개발·진단·리팩터링 | [첫 요청과 업무 흐름](guides/solo-development.md) |
| 여러 사람이 함께 작업 | [팀 준비·역할·통합·인계](guides/team-development.md) |
| 작업별 검사·전달 절차 선택 | [개발 workflow](developer-workflow.md), [기능 작업 상세](guides/feature-development.md) |
| 로컬 검사·선택 자산 관리 | [로컬 검사](local-development.md), [적용·갱신·제거](repo-assets.md) |
| 차단·실패 해결 | [가드·도구 문제](troubleshooting.md), [스택 문제 선택](standards-scope.md#문제-해결-안내를-읽는-방법) |

가이드 본문과 복사용 요청은 위 정본 한 곳에만 둔다. 기존 공개 URL은 아래 호환 경로로 유지한다.

## 현재 계약·기술 참조

제품의 기존 규약을 먼저 확인하고 [표준 적용 기준](standards-scope.md)에 따라 필요한 것만 채택한다.

| 영역 | 정본 |
|---|---|
| Git Flow·리뷰·병합·보호 | [code-review](code-review.md), [GitHub 정책 보존](company-policy.md) |
| AI 협업·QA·문서 동기화 | [협업 계약](ai-collaboration.md), [동기화 선언](ai-collaboration-document-sync.md), [실행 증거](qa-evidence-guide.md) |
| 스택 선택·버전 | [스택 안내](stack-guide.md), [버전 확인](stack-versions.md) |
| 스택별 문제 진단 | [백엔드](stack-troubleshooting-backend.md), [프론트엔드](stack-troubleshooting-frontend.md), [데이터베이스](stack-troubleshooting-database.md) |
| 구조·서비스 경계 | [클린 아키텍처](clean-architecture.md), [인프라 구조](architecture-infra.md) |
| API·데이터·인증 | [API](api-standards.md), [DB](db-standards.md), [Auth](auth-standards.md) |
| 화면 설계·구현 | [프론트엔드 설계](frontend-engineering.md), [디자인 기준](frontend-design-standards.md), [한국어 UX](korean-ux.md) |
| 장애·비밀정보 사고 | [운영](operations.md), [시크릿 대응](operations-secret-response.md) |
| 문서·그림 | [README 기준](readme-standards.md), [아키텍처 그림](architecture-diagram-standards.md), [그림 배치](architecture-diagram-layouts.md) |
| 모델·역할 | [모델 운영 연결](model-tiering.md) |

## 제품 설계·유지보수

| 질문 | 정본 |
|---|---|
| Harness가 소유할 일인가 | [제품 방향](product-direction.md), [제품 경계](product-boundaries.md) |
| 어떤 구성으로 실행되는가 | [구조 그림과 재생성](harness-architecture.md), [플러그인 구성](harness-plugin.md) |
| 어디를 고쳐야 하는가 | [저장소 구조·생성 정본](repository-structure.md) |
| 플랫폼과 겹치는 기능은 | [현재 인벤토리·중복 판정](platform-overlap-audit.md) |
| 변경·버전·발행 절차는 | [유지보수](harness-maintenance.md) |
| 결정 이유와 반영 위치는 | [결정 인덱스](decisions.md) |
| 시험·인수의 범위는 | [보편적인 개발 환경의 완료 판정](company-acceptance.md), [공개 안전성](public-safety-audit.md) |
| 분리 패키지 상태는 | [실험 경계](product-boundary-experiment.md), [실험 정본](../experiments/split-packaging/README.md) |

정책·설치·유지보수 문서의 기존 루트 경로는 배포된 스킬·템플릿·검사기의 조회 계약이기도 하다.
이를 유지하면서 위 인덱스로 분류한다. 폴더 모양을 맞추려고 `reference/`·`design/` 사본을 만들지 않는다.

## 계획·실행 증거·역사

| 필요한 정보 | 찾는 곳과 읽는 방법 |
|---|---|
| 승인된 목표·범위·완료 기준 | `specs/`의 해당 명세. 상태와 후속 링크부터 확인한다 |
| 현재 진행·다음 행동 | 백로그는 [GitHub Issues](https://github.com/grinvi04/team-harness/issues), 로컬 작업은 `.project-map/`. 계획 문서 수를 진행률로 세지 않는다 |
| 현재 재설계의 검증·전달 경계 | [재설계](specs/team-harness-redesign.md) → [실행](specs/team-harness-redesign/execution.md) → [전달](specs/team-harness-redesign/delivery.md) |
| 재설계 전 세 흐름의 실패·재시험 | [2026-10-15 평가 계획](specs/workflow-evaluation-2026-10-15.md) → [보고서](pilots/workflow-evaluation-2026-10-15.md) → 원래 JSON |
| 그 이전 비교의 한계 | [2026-10-14 평가](pilots/workflow-maturity-2026-10-14.md) |
| 실행 증거 | `pilots/`의 보고서·manifest·JSON. 후보·환경·최초 FAIL·재시도·미확인을 함께 읽는다 |
| 과거 결정 | [초기·하드닝](decisions-foundation-and-hardening.md), [native·delivery](decisions-native-and-delivery.md), [도입](decisions-company-adoption.md) |
| 과거 방향·운영 | [소비 프로젝트](product-direction-consumer-history.md), [거버넌스](product-direction-governance-history.md), [로드맵 근거](product-direction-roadmap-evidence.md), [운영 이력](harness-operating-history.md) |
| checkout 밖에 보존한 원문 | [고정 Git 증거·복원 방법](history-evidence.md) |
| 발행별 변경 이력 | [CHANGELOG](../CHANGELOG.md), [릴리즈 목록](changelog/releases.md). 생성 명령으로 갱신한다 |

구현·검증·병합·태그·설치·배포는 서로 다른 상태다. 보고서의 PASS는 적힌 후보와 범위에만 유효하다.
과거 기록이 “당시 미발행”이라 해도 지금의 미발행을 뜻하지 않는다. 후속 PR·태그 등 연결된 원본에서 확인한다.

## 파일명·수명 관리

1. 새 파일은 목적을 나타내는 영문 소문자 `kebab-case.md`로 쓴다. 단독/팀/기존 저장소처럼 독자를 구분한다.
   `README.md`·`AGENTS.md` 같은 탐색·도구 진입점은 정해진 이름을 유지한다.
2. 날짜가 고정된 평가에는 `workflow-evaluation-YYYY-MM-DD.md`처럼 시점을 넣는다.
   `current`, `latest`, `final-v2`를 과거 결과의 이름으로 사용하지 않는다. 기존 증거의 ID·경로는 함부로 바꾸지 않는다.
3. 현재 안내는 실행 가능한 사용법·계약만 소유한다. 명세는 승인 범위·결정, 보고서는 실제 실행과 한계를 소유한다.
   작업 종료 때 달라진 사용법은 현재 안내에 반영하고 명세/증거를 연결한다. 같은 본문을 여러 곳에 복제하지 않는다.
4. 과거 결과·최초 실패·후보·환경·digest는 보존한다. 잘못된 설명은 정정 이유와 후속 링크를 덧붙이고 원문을 덮지 않는다.
5. 재생성 가능한 파일은 정본·생성 명령을 연결한다. AI가 쓴 문서라는 이유만으로 생성물로 취급하지 않는다.
   코드·테스트는 기존 기능 소유 경로를 따른다. `.runtime/`도 유일한 증거인지 확인한 뒤 정리한다.
6. 이동은 본문과 실제 reader를 함께 바꾸고 공개 경로/앵커를 검사한다. 직접 읽는 소비자가 있으면 경로를 유지한다.
   소유 Markdown은199줄 이하로 유지하되 긴 한 줄이나 링크 뒤로 핵심 권한·검증 계약을 숨기지 않는다.

분류는 [Diátaxis의 점진적 개선](https://diataxis.fr/how-to-use-diataxis/), 정본·중복 억제는
[Google 문서 관리 원칙](https://google.github.io/styleguide/docguide/best_practices.html),
짧은 진입점과 연결된 지식은 [Harness engineering](https://openai.com/index/harness-engineering/)을 참고했다.
위 배치는 이 저장소의 실제 소비 관계에 맞춘 선택이며, 특정 폴더 구조의 보편적 최적성을 주장하지 않는다.

## 호환 경로

| 이전 경로 | 새 정본 | 유지 이유 |
|---|---|---|
| [company-onboarding.md](company-onboarding.md) | [guides/existing-repository.md](guides/existing-repository.md) | 기존 공개 링크; 회사 소속이 필요하다는 이름 오해 해소 |
| [development-coordination.md](development-coordination.md) | [guides/solo-development.md](guides/solo-development.md) | 기존 공개 링크·초기 사용 요청의 깊은 링크 |
| [team-development-guide.md](team-development-guide.md) | [guides/team-development.md](guides/team-development.md) | 기존 공개 링크·팀 요청 앵커 |
| [developer-workflow-feature.md](developer-workflow-feature.md) | [guides/feature-development.md](guides/feature-development.md) | 기존 workflow 상세 링크 |
| [workflow-maturity-current-evaluation.md](specs/workflow-maturity-current-evaluation.md) | [날짜가 고정된 평가 계획](specs/workflow-evaluation-2026-10-15.md) | 과거 스펙·동기화 선언의 원래 경로 |
| [current-evaluation-2026-10-15.md](pilots/current-evaluation-2026-10-15.md) | [날짜가 고정된 평가 보고서](pilots/workflow-evaluation-2026-10-15.md) | 과거 공개 링크; 동명 JSON·증거 ID는 유지 |

호환 파일은 해당 절로 이동하는 안내만 둔다. 새 현재 안내에서는 새 정본을 직접 연결한다.
스크립트의 호환 파일은 별도 [유지 이유](repository-structure.md#과거-기록을-찾을-때)를 따른다.
