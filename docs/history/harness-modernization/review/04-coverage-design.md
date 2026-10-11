# 검토 범위·증거·재설계

## 고정한 원본

Harness HEAD: 980fe87b4429e601e7f95155063eb2c28906fbaf.
tracked 파일명·바이트 SHA-256: 440c4645e947e1dea767e351e6a7139ce784b89c59460bf17f276a07b8ec95c4.
브랜치 fix/drivertree-contract-progress, 기존 tracked 변경은 .gitignore뿐이다.

| 저장소 | tracked MD | 199줄 초과 | 현재 HEAD |
|---|---:|---:|---|
| Harness | 171 | 13 | 980fe87b4429e601e7f95155063eb2c28906fbaf |
| ERP | 40 | 1 | 085d0cebb6aefd3152e475e8337ff988a281f5ff |
| siku | 9 | 0 | 2476e1754c4e2fcf2e53ce749f3464cd8228ea74 |
| webhook-service | 9 | 4 | e1eee56e101be3fc61526430599773116cd95797 |
| DriveTree | 24 | 5 | ff5f26f120ad4bb5629cc371839ff69edea544cc |
| 합계 | 253 | 23 | 각 원본의 후보를 유지 |

[MD 전체 목록·바이트·digest](../md-inventory.json). 본문 검토와 자동 숫자 검사를 구분했다.
전역 소유 MD 7개, Harness 지도 2개, 소비 지도 4개도 별도로 읽었다.
common.md·Codex AGENTS·Claude CLAUDE의 152줄/16,162바이트와 동일 digest를 확인했다.
기존 사용자 변경·소비 지도·ERP의 untracked Codex 파일은 보존했다. 외부 plugin 원본·캐시·backup·credentials는 편집 대상으로 삼지 않았다.

## 199줄 초과 목록

| 문서 | 현재 줄 수 |
|---|---:|
| [Harness/CHANGELOG.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/CHANGELOG.md) | 563 |
| [Harness/README.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/README.md) | 388 |
| [Harness/docs/ai-collaboration.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/ai-collaboration.md) | 240 |
| [Harness/docs/architecture-diagram-standards.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/architecture-diagram-standards.md) | 223 |
| [Harness/docs/decisions.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/decisions.md) | 384 |
| [Harness/docs/developer-workflow.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/developer-workflow.md) | 242 |
| [Harness/docs/pilots/consumer-readiness-2026-10-07.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/pilots/consumer-readiness-2026-10-07.md) | 695 |
| [Harness/docs/product-direction.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/product-direction.md) | 281 |
| [Harness/docs/specs/codex-guard-compatibility.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/specs/codex-guard-compatibility.md) | 369 |
| [Harness/docs/specs/multi-project-qa-validation.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/specs/multi-project-qa-validation.md) | 282 |
| [Harness/docs/specs/qa-command-binding-validation.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/docs/specs/qa-command-binding-validation.md) | 576 |
| [Harness/plugins/harness-guard/skills/loop/SKILL.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/loop/SKILL.md) | 423 |
| [Harness/plugins/harness-guard/skills/milestone/SKILL.md](https://github.com/grinvi04/team-harness/blob/980fe87b4429e601e7f95155063eb2c28906fbaf/plugins/harness-guard/skills/milestone/SKILL.md) | 316 |
| erp/README.md (`$HOME/project/erp/README.md`, 당시 로컬 원본) | 210 |
| webhook-service/AGENTS.md (`$HOME/project/webhook-service/AGENTS.md`, 당시 로컬 원본) | 241 |
| webhook-service/README.md (`$HOME/project/webhook-service/README.md`, 당시 로컬 원본) | 378 |
| webhook-service/docs/qa/2026-10-07/README.md (`$HOME/project/webhook-service/docs/qa/2026-10-07/README.md`, 당시 로컬 원본) | 326 |
| webhook-service/docs/specs/quality-remediation.md (`$HOME/project/webhook-service/docs/specs/quality-remediation.md`, 당시 로컬 원본) | 246 |
| drivetree/DESIGN.md (`$HOME/project/drivetree/DESIGN.md`, 당시 로컬 원본) | 292 |
| drivetree/PRD.md (`$HOME/project/drivetree/PRD.md`, 당시 로컬 원본) | 282 |
| drivetree/README.md (`$HOME/project/drivetree/README.md`, 당시 로컬 원본) | 274 |
| drivetree/docs/CODING_STANDARDS.md (`$HOME/project/drivetree/docs/CODING_STANDARDS.md`, 당시 로컬 원본) | 346 |
| drivetree/docs/specs/quality-remediation.md (`$HOME/project/drivetree/docs/specs/quality-remediation.md`, 당시 로컬 원본) | 260 |

## MD 외 Harness 구성요소

Harness tracked 전체는 732개이며 MD 외 561개다. 433개는 tests 아래 파일로 시험·fixture가 큰 비중을 차지한다.
개수는 누락 점검용 inventory이고, 모든 fixture를 사람이 한 줄씩 읽었다는 주장은 아니다.

| 구성 | 확인 방식 | 남은 실행 경계 |
|---|---|---|
| hook·guard·egress·tokenizer | 원본·caller·negative/benign 분류·기존 시험 | 실제 host hook dispatch 신규 실행은 미실행 |
| PR·보호·solo wrapper | 원본·fake API·공식 gh 옵션·원격 GET | 실제 원격 쓰기·복구는 미실행 |
| migration·SQL/Python/Ruby checker | 원본·기존 fixture 시험·구문 유효 반례 | 실제 DB 실행은 미실행 |
| setup·permissions·profiles | 원본·상대 경로·메모리 파일 시스템·기존 시험 | 사용자 실제 설치 변경은 미실행 |
| manifests·catalog·package builder·release | JSON·binding·digest·재현성 계약 시험 | marketplace 발행·설치는 미실행 |
| CI·test guard·commit metadata | quality 로컬 재현·구문·조건·직접 소비자 | GitHub 신규 workflow 실행은 미실행 |
| native loader·split runner·trust | 원본·기존 후보/권한/신뢰 시험 | 새 native 세션·모델 smoke는 미실행 |
| SVG·HTML·PNG·라이선스 | 생성 로직·XML·HTML 본문·PNG 2개 직접 시각 확인·MIT/출처 대조 | 실제 운영 화면·새 자산 생성은 미실행 |
| 프로젝트 지도 서비스 | 현재 문서와 순수 parser 반례 | 원본 서비스 쓰기·재시작은 미실행 |
| 전역 config·role·execpolicy | 선택 설정·역할 계약·실제 CLI 정책 판정 | 역할별 같은 과제의 품질·사용량 비교는 미실행 |

[남은 실행의 사유·확인 기준·제외 범위](06-global-scope-addendum.md)를 추가했다. 위 미실행 항목 전부가 필수 검증이나 승인 차단을 뜻하지 않는다.

## 실행한 검사

[당시 원본 상태 대조](../final-source-state.json)는 그 기록 시점의 시작/종료 비교다. 이후 Codex config digest가 바뀌어 현재 파일 전체의 PASS로 이월하지 않는다.
[계획 작성 시 재확인](../planning-source-state.json): Harness HEAD/tracked digest와 세 공통 지침 사본은 유지됐고 Codex CLI는 0.161.0이다. 최신 config digest는 별도로 고정했다. 소비 원본은 구현 전에 표적 재확인한다.

[quality 최초 결과](../results.json)는 60 PASS/3 FAIL이다. [재시도](../retries.json)는 영향 3개 모두 PASS다.
실패 조건: 조사자가 HARNESS_GUARD_LOG를 고정해 시험의 HOME 기반 기본 로그 경로와 충돌했다. 바꾼 가설·환경을 기록하고 첫 실패를 보존했다.
63단계는 현재 ci-gate quality run step이며 PR 입력은 synthetic noImpact이다. Ruff 설치 단계는 이미 설치된 같은 0.15.15 버전을 확인하는 방식으로 대체했다.
JSON/CJS/MJS/Python/Bash/XML 추가 구문 152개를 확인했다. 의도적 invalid fixture 73개를 성공 대상으로 바꾸지 않았다.
YAML 83개는 다중 document를 고려해 확인했다. 최초 파서의 6 INVALID와 교정 결과를 [각각](../yaml-syntax.json) [보존](../yaml-retries.json)했다.
Gitleaks 8.30.1은 현재 HEAD 조상 744커밋/7.32MB에서 finding 0, exit 0이었다. [결과](../gitleaks.json).
원격 보호 10건·ruleset 목록 5건은 읽기만 했다. ERP 추가 CodeQL rule의 대상·severity·bypass 없음도 확인했다.
독립 읽기 전용 검토 두 역할이 원본에서 검토했다. 세 번째 역할 호출은 thread limit으로 실패해 직접 조사로 이어갔다. 더 많은 역할이 실행됐다고 보고하지 않는다.

## 이전 설계에서 유지·보완할 점

유지: 모든 소유 MD의 199줄 상한, 사람과 에이전트의 진입점, 단일 정본, 플랫폼 native-first, 배포 제외 경계.
보완: 글자 수·토큰·중복·필수 읽기 비용도 확인한다. 줄 합치기나 제목만 분할하는 방식으로 상한을 맞추지 않는다.
현재 규칙·사용 안내·수용 기준·진행 상태·역사·생성 문서를 구분한다. 같은 상태를 여러 등록부에 복제하지 않는다.

| 정보 | 진입점·배치 제안 | 반드시 유지할 계약 |
|---|---|---|
| 권한·원본 보존·미확인 완료 금지 | 전역/루트 자동 진입 문서 | 핵심 규칙을 링크만 남겨 숨기지 않음 |
| 사용자 사용법·작업별 길찾기 | README와 짧은 task index | 독자가 다음 문서를 선택할 수 있음 |
| 공통 기술·QA 기준 | 주제별 standards 문서 | 적용 조건·요구 수준·판정자·한계 |
| 작업 순서·delivery | workflow 문서와 SKILL entry | 실제 wrapper·명령·phase·핸드오프 |
| 모델·플랫폼 지원 | 플랫폼별 policy와 상세 reference | client/provider/version/effort와 실제 실행 구분 |
| 제품 요구·수용 기준 | 기존 docs/specs/<name>.md entry | F5·route·고정 AC·원래 요구 |
| 현재 상태 | 기존 spec/issue/PR·현재 roadmap | 후보·근거·다음 행동·해제 조건 |
| 역사·과거 결정 | 내용 보존 chunk와 현행 정본 연결 | 당시 날짜·SHA·PASS/FAIL 보존 |
| 생성 CHANGELOG·그림 | generator·소비 CI와 함께 설계 | 재현 가능한 원본·동일 후보 |

디렉터리는 의미가 있는 1~2단계를 우선한다. 모든 짧은 파일까지 다시 나누거나 별도 진행 등록부를 추가하지 않는다.
불변 원본·생성 문서도 사용자의 전체 MD 범위에 포함한다. 보존·생성 계약을 갖춘 분할을 설계하며 예외를 임의로 승인하지 않는다.

## 문서와 함께 바꿀 직접 소비자

F5/route 최상위 spec 경로, Codex wrapper 상대 경로·제목, loop Phase 계약, package catalog·builder command rewriting.
new-repo의 AGENTS/CLAUDE/rules 복사·읽기 연결, semantic parity, decisions 문자열·제목 slice를 읽는 시험.
CHANGELOG 전체 태그 생성·루트 바이트 비교 CI, doc-sync 선언 경로·digest·후보 기록.
지도 projects.json 경로·section 설정과 projects/consumer-progress/drivetree-progress/product-roadmap 파서의 제목·AC·날짜·SHA.
이전 경로에 link-only index만 남기는 방식은 실제 reader를 시험하기 전에는 호환성 보장으로 취급하지 않는다.

## 실제 수정 후 완료 기준

1. 해당 반례가 원본에서 실패하고 수정 후보에서 기대대로 거부되며 정상 대조군은 유지된다.
2. API·명령 실패가 PASS/SKIP로 숨겨지지 않고 실제 비적용만 SKIP이다.
3. 보고서·review·PR·태그가 같은 후보와 실행 파일·원본 바이트에 연결된다.
4. 모든 소유 MD가 199줄 이하이고 경로·앵커·버전·현행/역사 표기가 맞는다.
5. 작업별 필수 지침이 실제 host 세션에 전달되고 optional reference는 필요한 때만 읽힌다.
6. 문서 변경에 의존하는 parser·catalog·generator·template·binding 시험이 같은 후보에서 통과한다.
7. 소비 지침은 실제 stack·명령·DB 시험 경계·Git 흐름과 맞고 기존 사용자 변경을 보존한다.
8. 모델 역할·effort 설정, 실제 실행, 같은 과제의 품질·사용량 비교 결과를 별도로 보고한다.
9. 영향 검사와 필수 CI·독립 검토·진행 문서 현행화가 완료되고 필수 FAIL/UNVERIFIED가 없다.
10. 배포·운영 환경 구성이 완료되지 않아도 승인된 로컬/CI 범위는 종료할 수 있으며 원격 미확인은 그대로 표시한다.

이번 검토만으로 모든 가능한 취약점·모든 플랫폼 동작·모든 앱 기능의 완전성을 보장하지 않는다.
조사 범위에서 찾은 결함과 미실행 영역을 서로 바꾸지 않고, 구현 단계에서 위 증거를 충족해야 한다.
