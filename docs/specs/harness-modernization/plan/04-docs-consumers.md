# 단계 4 — 문서 구조와 직접 소비자

근거: [D01–D10·C01–C07](../review/03-docs-consumers.md), [전체 목록·23개 초과 문서](../review/04-coverage-design.md).
진행 상태: 계층·생성기·소비 문서의 로컬 적용/검사/커밋과 현재 지도 reader218개 검사·실제 정본 연결을 확인했다. 내용·이력·직접 소비 경로 보존과 개별 검증 한계는 아래 기록을 따른다.
숫자 기준은 모든 소유 MD의 물리적 줄 수 199 이하이며 빈 줄/frontmatter도 포함한다.
새 모델로 역사상 모델 이름·날짜·후보·실패/성공을 덮어쓰지 않는다.

현재 근거: [내용 보존](../execution-d4bc.json)·[개인 reader 후보](../execution-d4d.json)·[소비 로컬 적용](../execution-consumer-apply.json)·[표준 관찰](../execution-d4f.json).
4D의 695줄 재구성은 후보에서 확인했다. 서비스가 별도 `project/project-map`으로 이동한 현재 호출부에 최소 후보를 다시 연결해 기존211+새7시험 PASS를 확인했다. 별도 Astra/medium 실제 read-only/never 독립 검토와 원문/현재 parser·UI·registry 연결 반증 PASS를 확인했다. 승인된 v0.82.0으로 실제 ROOT를 fast-forward하고 현재 controller의 소유 확인 재시작·7개 HTTP 응답에서 정본 sourceReady/no error를 확인했다. 이전 Documents 서비스는 복구 사본이며 적용 대상이 아니다.
아래는 범위 확인용 재사용 체크리스트다. 미체크 표시 자체를 새 백로그로 세지 않으며 각 AC의 실제 상태와 한계는 위 실행 기록을 따른다.

## 4A — 진입점과 내용 단위

수정: 전역 common/두 진입점, Harness `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/`의 영향 문서.
consumer 루트 AGENTS/CLAUDE/README와 명시된 하위 지침도 같은 원칙을 적용한다.
인터페이스: 자동 진입 규칙 → 작업별 필수 읽기 → 주제 정본·현재 spec/issue/PR·보존 역사.

- [ ] 전체 소유 MD 목록은 tracked·미추적 사용자 문서·명시적으로 소유한 ignored 지침/스펙/진행 문서와 전역 지정 경로로 고정한다.
- [ ] 생성 MD도 포함한다. 외부 plugin 원본/cache·dependency·backup은 제외 근거로 구분하며 Git ignore 여부만으로 소유 문서를 제외하지 않는다.
- [ ] 핵심 권한·원본 보존·미확인 완료 금지는 자동 진입 본문에 유지한다.
- [ ] 사람의 시작 안내, 주제별 standards, 실제 workflow, 요구/spec, 현재 상태, 역사를 구분한다.
- [ ] 1~2단계의 의미 있는 계층과 작업별 읽기 표를 두되 짧은 문서를 형식적으로 더 나누지 않는다.
- [ ] 주요 진입점의 바이트·필수 읽기 양·중복을 함께 비교하고 긴 한 줄로 상한을 맞추지 않는다.
- [ ] 같은 현재 상태를 새 register에 복제하지 않고 기존 spec/issue/PR의 근거·다음 행동을 연결한다.

AC-D1: 모든 소유 MD ≤199줄, 핵심 규칙 누락 0, 문서 책임·필수 읽기·현재 정본이 명확하다.
링크는 자동 로딩의 증거가 아니다. 새 host 세션에서 필요한 지침 전달을 별도로 확인한다.

## 4B — 긴 문서·역사·CHANGELOG

대상: `docs/decisions.md`, `docs/pilots/consumer-readiness-2026-10-07.md`,
`docs/specs/codex-guard-compatibility.md`, `multi-project-qa-validation.md`, `qa-command-binding-validation.md`,
`docs/product-direction.md`, `docs/ai-collaboration.md`, `docs/developer-workflow.md`,
`docs/architecture-diagram-standards.md`, root `CHANGELOG.md`.
경로 없는 spec 이름은 `docs/specs/` 아래다. 나머지 초과 파일은 보고서 목록과 4E에서 연결한다.

- [ ] 기존 root/spec 경로는 짧은 진입점으로 유지하고 주제/시기별 본문을 분리한다.
- [ ] 당시 본문·순서·AC·날짜·SHA·최초 실패를 보존하고 대체된 안내에 현재 정본을 연결한다.
- [ ] 선택한 내용 보존 방식으로 분할 전후 누락/변경을 검토하고 역사 사실을 현재 PASS로 바꾸지 않는다.
- [ ] `scripts/generate-changelog.mjs`를 root index와 결정적 release별 chunk를 함께 생성하도록 설계한다.
- [ ] 제안 출력 `docs/changelog/`에도 같은 199줄 기준을 적용하고 항목을 삭제하지 않는다.
- [ ] 전체 태그/pre-tag 후보의 정본·출력 계약, release builder·CI의 byte 비교를 함께 이전한다.
- [ ] 재생성 결과의 결정성·누락 release/commit 없음·역사 내용 일치를 확인한다.

AC-D2: root index뿐 아니라 모든 chunk가 상한을 지키며 원래 역사와 생성 계약이 보존된다.
보존 문서도 범위에서 임의 제외하지 않는다. 특정 디자인 문서의 원본 보존은 내용 보존 분할로 충족한다.

## 4C — skill·packaging·test reader

수정: `plugins/harness-guard/skills/loop/SKILL.md`, `skills/milestone/SKILL.md`, 관련 reference,
Codex skill wrapper, `packaging/packages.json`, `scripts/build-packages.mjs`의 직접 문서 reader.
시험: `tests/loop-skill-test.sh`, `tests/skill-discovery-test.sh`, `tests/codex-skill-mapping-test.sh`,
`tests/package-catalog-integrity-test.sh`, `tests/package-workflow-binding-test.sh`, `tests/package-build-test.sh`,
`tests/flagship-skills-test.sh`, `tests/product-boundary-test.sh`, `tests/platform-overlap-audit-test.sh`.

- [ ] F5/route의 `docs/specs/<name>.md` 진입 계약과 필요한 최상위 spec 탐색을 유지한다.
- [ ] loop Phase·Codex 실행 계약·catalog 명령 치환 대상이 분할 뒤 어디서 읽히는지 명시한다.
- [ ] packaged reference·상대 링크·hook command가 staged artifact 안에서 실제 해석되는지 시험한다.
- [ ] decisions 제목/문자열 의존 시험은 새 정본을 읽게 이전하며 원래 의미·반례 검출력을 유지한다.
- [ ] 단순 문자열 기대값만 새 문서와 맞춰 통과시키지 않고 결과 계약을 검토한다.
- [ ] 위 영향 시험과 route-intent/package integrity/release-bundle의 해당 경계를 실행한다.

AC-D3: 소스 폴더와 설치용 묶음의 읽기 결과가 동일 계약을 충족하고 root 경로를 없애 생기는 누락이 없다.

## 4D — 지도 parser·현재 안내·그림

현재 직접 reader: `$HOME/project/project-map/`. 이전 Documents 경로는 복구 사본이다.
`projects.py`와 projects.json 및 실제 consumer-progress/drivetree-progress/product-roadmap reader가 대상이다.
우선 제목·AC·현재 상태의 기존 읽기 surface를 보존한다. 불가능하면 reader의 최소 이관을 구현 승인 범위에 명시한다.

- [ ] 제목 교체/link-only index의 원래 ValueError 반례와 현재 정상 roadmap fixture를 고정한다.
- [ ] 이전되는 document 본문·경로를 함께 읽게 하거나 호환되는 핵심 section을 root에 유지한다.
- [ ] 4개 소비 roadmap의 단계·AC·날짜·SHA·보류 해제 조건이 이전 전후 일치하는지 확인한다.
- [ ] 파서 오류/입력 drift/증거 없음은 done으로 바꾸지 않는다. 과거 지도는 당시 기록으로 유지한다.
- [ ] 현재 정책과 어긋난 README 예시·logs 경로·architecture 그림·소개 HTML을 원본 근거와 함께 정렬한다.
- [ ] 이미지/생성 source·HTML·문서의 Codex 경로·main/develop/solo 정책을 같은 기준으로 확인한다.

AC-D4: 기존 reader가 정상 동작하거나 함께 이전되어 실제 결과가 일치한다. source 안의 링크만으로 호환성을 주장하지 않는다.
개인 서비스는 프로젝트 코드와 다른 경로다. 필요 이상의 서비스 변경·재시작·배포 권한을 추정하지 않는다.

## 4E — 네 소비 프로젝트의 최소 정렬

| repo root | 변경 제안 | 확인할 실제 계약 |
|---|---|---|
| `$HOME/project/erp` | AGENTS·README·decisions·release-readiness·biz-vat 및 해당 stack rule | @TenantId와 native/manual tenant 경계, 현재 provider 구현, 실제 명령/cwd |
| `$HOME/project/siku` | AGENTS·CLAUDE·README·해당 TS/Vite stack rule | Vite/tsc 실제 scripts, 필수 하위 지침, 없는 screenshot 링크 |
| `$HOME/project/webhook-service` | AGENTS·README·decisions·quality-remediation·qa/2026-10-07/README | SDK 7.1.1의 현재 구현, 모델 출처, 당시 QA 후보/실패·현재 보류 |
| `$HOME/project/drivetree` | AGENTS·CLAUDE·backend/frontend 지침·README·DESIGN·PRD·CODING_STANDARDS·CI_CD·NEXT_STEPS·PUBLIC_API_PLAN·decisions·quality-remediation | QA/format 차이, 안전한 테스트 DB, 실제 stack·wrapper·현재 취소/보류 |

- [ ] 각 repo의 원본 후보·기존 사용자 변경·root/하위 지침을 확인한 뒤 서로 독립된 변경으로 처리한다.
- [ ] 앞 단계의 공통 기준을 복사할 때 repo의 기술 선택·실제 명령과 대조한다.
- [ ] ERP를 @Filter로 되돌리거나 앱 구조를 표준 문구에 맞추는 수정은 하지 않는다.
- [ ] DriveTree format/write와 read-only QA를 구분하고 안전한 local test DB 범위를 통일한다.
- [ ] siku에 없는 Next.js 지시/type-check 명령을 추가하지 않고 실제 tsc build 계약으로 안내한다.
- [ ] 고정 Sonnet 공동 작성자 대신 실제 기여 출처를 연결한다.
- [ ] 모든 MD·앵커·참조 자산·실행 디렉터리·현재/역사 표기를 검사하고 필요한 영향 QA만 실행한다.

AC-D5: 문서가 현재 구현·stack·명령·로딩과 일치하고 모든 소유 MD가 상한을 지킨다.
앱 전체 기능/테넌트 보안/배포를 새로 완료했다고 보고하지 않는다. 원래 제품 QA 기록은 당시 후보로 보존한다.

## 4F — 공통 기술 표준의 보장 범위

수정: `docs/api-standards.md`, `docs/db-standards.md`의 해당 계약만 보완한다.

- [ ] CSV escape와 formula 중화를 구분하고 quote만으로 수식이 없어지지 않는 반례를 유지한다.
- [ ] 실제 지원 Excel/Sheets 등 소비 도구·재저장 조건에 맞는 중화 방식을 확인한다.
- [ ] 안전한 합성 입력으로 CSV round-trip과 소비 결과를 관찰한다. 소비 도구를 실행 못 하면 그 보장은 UNVERIFIED다.
- [ ] 코드 생성 OpenAPI가 요구·권한·오류·경계·설명 drift를 자동 방지한다는 표현을 줄인다.
- [ ] 금액의 소비자 정밀도·범위·반올림·JSON/DB 표현 계약과 확인 방법을 명시한다.

AC-D6: 기술 표준의 보장이 실제 관찰 경계와 일치하고, CSV 인용/자동 생성/DB numeric만으로 안전·정확성을 보장하지 않는다.
네 제품의 API/금액/export 기능을 이 표준 수정에 맞춰 전면 재구현하지 않는다.

## 공통 검사와 단계 완료

기존 도구를 우선한다. 소유 MD의 199줄·기본 local link 검사가 없으면 최소
`scripts/check-markdown-structure.mjs`와 경계 회귀 `tests/markdown-structure-test.mjs`를 추가한다.
199/200줄·마지막 newline·CRLF·생성 chunk·범위 제외·깨진 실제 링크를 확인한다.
example/template의 미래 경로를 실제 링크 누락과 구분하고 문자열 검사가 의미/지침 전달을 보장한다고 쓰지 않는다.
독자가 실제 작업의 정본·필수 읽기·다음 행동을 찾는 대표 과제로 탐색성도 확인한다.
같은 과제에서 초기 전달 문맥·실제 읽은 문서·cache·출력·재작업도 기록한다. 199줄/전체 대화 미복사만으로 token 절감을 보장하지 않는다.
doc-sync 선언은 이동한 원본·직접 소비자·현재 상태를 연결한다. 관련 문서를 형식적으로 전부 수정하지 않는다.
