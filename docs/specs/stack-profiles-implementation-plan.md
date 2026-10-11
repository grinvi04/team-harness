# 개별 스택·화면 방식과 버전 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 프로젝트에 개별 스택·UI 선택과 적용 전 버전 검증을 연결한다.
**Architecture:** 카탈로그가 선택과 정본을 연결하고 기존 생성기를 확장한다. 읽기 전용 판정과 기록 저장을 나눠 셋업·CI·repo-sync가 같은 결과를 소비한다.
**Tech Stack:** Bash, Node ESM, npm semver, PyPA packaging, RubyGems; Harness tooling에만 검사 의존성을 둔다.
**Spec:** [승인된 구성과 이번 수정 명세](stack-profiles-version-contract.md). 실행자는 두 문서를 함께 읽는다.

## Global Constraints

- 기존 번호1~6 유지, 7 `react`, 8 `nuxt` 추가; Python은 3번의 `django|fastapi|flask` 선택이다.
- Django `templates|htmx|api`, Flask `templates|api`, FastAPI `api`, Rails `hotwire|inertia-react|inertia-vue|api`다.
- 고정 풀스택 파일 없이 개별 자산을 조합한다. 기존6개 생성물·12조합·Spring Boot/Vue local checker는 회귀 대상이다.
- 기존 범용 Python/Rails 생성물은 호환 경로다. 새 전문 프로필에는 DB·Redis·Celery 제품을 기본 주입하지 않는다.
- 버전 우선순위는 명시적 exact/latest → 기존 확정 버전 → 최신 안정 제안; Node 기본은 호환되는 지원 LTS다.
- 불명확한 기존 버전을 최신으로 채우지 않는다. 요청/기존 차이·충돌·미확인은 nonzero와 조치 안내다.
- 미리보기는 읽기만 한다. `--apply`도 앱 의존성·lockfile·전역 설정을 바꾸지 않는다.
- 가드·시크릿·CI 권한/action SHA·브랜치 보호·사용자 파일·복구 자료를 보존한다. 소유 Markdown은199줄 이하다.
- 소비 원격·배포·결제·Claude 인증/실제 모델·전역 설치·PR/병합/발행/설치는 이 구현 계획에서 제외한다.
- 사용자는 Native 순차 구현과 마지막 독립 검토를 승인했다. 아래 checkbox는 실제 실행 후에만 완료로 표시한다.
- 2번 키·경로·정식 명령은 `spring-boot`로 통일한다. 기존 `spring` CLI 별칭·공식 설정키·Framework 명칭·과거 원문은 보존한다.

## Review Focus

1. 다중 Python/UI 증거: 임의 선택하지 않고 명시적 선택을 받는다 — Task2.
2. Hotwire importmap은 Node 없이 가능; Inertia는 선택 adapter가 없으면 거부한다 — Task2·3.
3. 선택 peer·환경 marker·prerelease: 해당 생태계 해석대로 판단하고 미사용 항목을 강제하지 않는다 — Task3.
4. 검사 후 입력 변경·기존 파일·symlink·저장 실패: 이전 파일을 보존하고 기록 적용을 중단한다 — Task4.
5. 조회 timeout·틀린 schema·추출 불가 지원 조건: 미확인과 nonzero를 반환한다 — Task3·5.

## 공통 인터페이스·실행 준비

경로는 저장소 루트 기준이다. 현재 기준 `c701ecc`, 작업공간 `fix/structure-cleanup`; 먼저 실제 원본·다른 작업을 확인한다.
`Selection`은 기존 반환 필드를 유지하고 `projects`를 추가한다. 각 항목은 `{role,directory,stackKey,framework,ui,legacy,versionComponents}`다.
`role`은 단독 `project` 또는 분리형 `backend|frontend`; 단독 directory는 `.`이며 framework/ui는 미선택 시 null이다.
`Inspection={selection,observed,inputs,issues,requirements,packages}`; observed는 `role.component`별 `{state,version}`, state는 `exact|absent|unresolved`다.
`requirements`는 정적 조건, `packages`는 peer 판정을 위한 직접 npm 의존성 증거이며 최종 기록에서 전체 목록을 제외한다.
`inputs`는 허용한 상대경로·SHA-256 목록이며 부재 파일은 null 지문으로 남긴다. `.env`·자격증명은 읽지 않는다. 허용 manifest/설정만 읽고 앱 코드를 실행하지 않는다.
`VersionResult={schema:1,selection,observed,targets,requirements,sources,inputs,issues,status}`; status는 `compatible|conflict|unverified`다.
`targets`는 exact 버전 map, sources는 공식 URL·조회 시각·조건, issues는 code·대상·조치다. 출력에 전체 의존성 그래프를 넣지 않는다.
새 Node 시험은 `node:test`; `tests/fixtures/stack-profiles/`의 작은 고정 manifest를 쓴다. 네트워크·gh는 시험에서 stub이다.
커밋은 각 Task의 소유 파일만 `git -C "$STACK_WORKTREE" add <경로>`로 stage하고 Conventional 한국어 제목으로 한다.
`feat|fix|refactor`는 `git -C "$STACK_WORKTREE" commit -m '<제목>' -m '이유: <문제와 변경 목적>'`을 사용한다.

### Task 1: 선택 카탈로그와 개별 CI 자산

**Files:** 수정 `templates/stacks.json`, `scripts/{stack-catalog,generate-stack-templates}.mjs`, `tests/stack-templates-test.sh`, `scripts/setup-local.mjs`, `tests/local-setup-test.mjs`; Spring Boot 이름의 직접 reader·검사·사용 안내·버전도 같은 단계에서 이전한다.
생성 `templates/stacks/{react,nuxt}/ci/{header,quality}.yml`, `python/ci/profile-quality.yml`, `rails/ci/profile-quality.yml`.
생성 `templates/stacks/python/frameworks/{django,fastapi,flask}/ci/steps.yml`, `templates/stacks/rails/ui/{hotwire,inertia-react,inertia-vue,api}/ci/steps.yml`.
**Interfaces:** 기존 `selectStack(selection,options={},catalog=loadCatalog()): Selection`에 framework/ui 옵션을 추가한다.
`renderSelectedWorkflow(selected:Selection,versionRecord:VersionResult|null=null,root=repositoryRoot): string`을 생성기에 추가한다.
- [x] 실패 시험 `profile_selection_preserves_legacy`를 `tests/stack-templates-test.sh`에 추가한다.
```js
assert.equal(selectStack('7').key, 'react'); assert.equal(selectStack('8').key, 'nuxt');
assert.equal(selectStack('3', {framework:'django',ui:'htmx'}).projects[0].framework, 'django');
assert.throws(() => selectStack('4+7', {ui:'inertia-react'}));
```
- [x] `bash tests/stack-templates-test.sh` 실행: 새 선택을 거부해서 RED, 기존 hash·12조합 사례는 유지한다.
- [x] 카탈로그·렌더러와 차이만 담은 자산을 구현한다. API 분리형만 조합하고 같은/탈출 경로는 기존 validator로 거부한다.
새 Python job은 공통 설치·lint/format/type 검사와 framework 검사, Rails는 공통 Ruby 검사와 UI 단계만 합친다.
DB 서비스는 자동 생성하지 않는다. Django는 `manage.py check`와 native test, FastAPI/Flask는 pytest를 기본 안내한다.
설치된 검사 도구와 명시적 npm script/테스트 경로를 확인하며 없으면 안내·중단한다. `--if-present`로 필수 검사를 생략하지 않는다.
React/Vue 공통 rule 재사용 경로는 Task6에서 채운다. 다른 소유 파일을 바꾸는 task와 동시 쓰지 않는다. 기존 `--compose` 유지, 새 단독/전문 선택 출력은 `--render <선택>`이다.
- [x] `node scripts/generate-stack-templates.mjs --write`, `--check`, `bash tests/stack-templates-test.sh`: PASS; 기존 생성물 hash와 보호 설정 동일.
- [x] 커밋 `feat(stack): 개별 프레임워크와 화면 구성 선택 추가`.

### Task 2: 기존 프로젝트를 실행하지 않고 읽기

**Files:** 생성 `plugins/harness-guard/scripts/{stack-project.mjs,read-stack-pyproject.py}`, `tests/stack-project-test.mjs`, `tests/fixtures/stack-profiles/`; 카탈로그의 판정 대상 연결.
**Interfaces:** `inspectStackProjects(projectRoot:string,selected:Selection): Inspection`을 plugin 정본에서 export한다. Task1의 projects를 소비한다.
Node package.json/npm lock v2·v3/런타임 선언, Python PEP621·정확히 고정한 requirements·런타임 선언을 읽는다.
Rails Gemfile.lock·.ruby-version·정적 선언과 importmap/package manifest, Spring Boot Gradle plugin·Java toolchain·wrapper를 읽는다.
- [x] `ambiguous_framework_and_ui`·`hotwire_without_node`·`unresolved_is_not_absent` 시험을 작성한다.
```js
assert.ok(inspectStackProjects(multiPython, pythonSelection).issues.some(i => i.code === 'AMBIGUOUS_FRAMEWORK'));
assert.equal(inspectStackProjects(hotwireImportmap, hotwireSelection).observed['project.node'].state, 'absent');
assert.equal(inspectStackProjects(unpinnedPython, pythonSelection).observed['project.django'].state, 'unresolved');
```
- [x] `node --test tests/stack-project-test.mjs`: export 부재로 RED.
- [x] inspector를 구현한다. PEP621는 동봉 helper의 Python3.11+ tomllib, lock/static 선언은 제한된 형식만 해석한다.
다중 framework/UI는 명시적으로 좁히고 미지원 lock·동적 Gemfile/Gradle·파서 부재는 issues에 남긴다. symlink 경로 탈출도 거부한다. Python3.11+가 없으면 pyproject 시험은 미확인으로 기록하고 통과라 하지 않는다.
Rails는 gem에 포함된 Hotwire와 외부 importmap pin을 구분하고 Inertia gem+선택 JS adapter를 확인한다. 누락/해석 불가는 미확인이다. installed plugin의 경로에도 inspector/helper가 포함돼야 한다.
선택하지 않은 framework의 버전까지 검증하지 않는다. DRF·django-htmx·Node를 서버 화면의 공통 필수물로 취급하지 않는다.
- [x] `node --test tests/stack-project-test.mjs`: PASS; 각 fixture 파일 digest·앱 실행 sentinel이 시험 전후 같다.
- [x] 커밋 `feat(stack): 기존 프레임워크와 버전 증거 판독`.

### Task 3: 공식 metadata와 생태계 버전 판정

**Files:** 생성 `scripts/stack-versions/{metadata,check,ranges}.mjs`, `{python-ranges.py,ruby-ranges.rb}`, `tests/stack-version-check-test.mjs`.
생성 같은 tooling 폴더의 `package.json`, `package-lock.json`, `requirements.txt`; 수정 `.github/workflows/ci-gate.yml`의 tooling 준비·시험.
**Interfaces:** `lookupVersionMetadata(component:string,request:string,fetchImpl=fetch): Promise<Metadata>`; Metadata는 exact·조건·source·시각이다.
`checkStackVersions({inspection:Inspection,requests:object,lookup,parsers}): Promise<VersionResult>`; ranges는 `satisfies(ecosystem,version,range,environment): {matches,issues}`를 제공한다.
- [ ] `constraints_and_lookup_failure` 시험에 정상·실패·Review Focus3/5를 고정한다.
```js
assert.equal((await checkStackVersions(nuxtNode22_0)).status, 'conflict'); // Nuxt4.6.1 engine 미충족
assert.equal((await checkStackVersions(missingInertiaAdapter)).status, 'unverified');
assert.equal((await checkStackVersions(timeoutMetadata)).status, 'unverified');
```
선택 peer 부재/설치, PEP440 marker·prerelease, Ruby `~>` 경계, exact/latest/기존 우선, 요청/기존 차이 사례도 추가한다.
- [ ] `node --test tests/stack-version-check-test.mjs`: export 부재로 RED.
- [ ] Harness tooling에 semver7.8.5·packaging26.3를 고정한다. RubyGems `Gem::Requirement`는 설치된 Ruby를 이용한다.
격리 준비는 `npm ci --prefix scripts/stack-versions`, Python3.11+ venv `.runtime/stack-versions/venv`에 requirements 설치다.
`STACK_VERSION_PYTHON`으로 해당 Python을 지정한다. 읽기 명령은 자동 설치하지 않으며 도구 부재도 unverified다.
공식 npm/PyPI/RubyGems·Node 릴리즈·선택 Java 배포판·Spring Boot/Gradle 지원 자료를 조회한다. source host·schema·크기·timeout을 제한한다. 조건을 쓰는 package의 실제 설치 여부와 정적 module 선언을 확인한다.
각 확정 릴리즈의 runtime·peer·UI 조건만 대조한다. Java 배포판/공식 조건 추출 불가·조회 실패는 추정 PASS 대신 unverified다.
최신 제안으로 unresolved를 숨기지 않는다. optional peer/marker는 실제 사용·대상 환경에 맞추고 API 통합까지 보장하지 않는다.
- [ ] 위 tooling 준비 뒤 `node --test tests/stack-version-check-test.mjs`: PASS. 조회는 stub이며 공식 parser 경계는 실제 실행한다.
- [ ] 커밋 `feat(stack): 공식 조건 기반 버전 충돌 판정`.

### Task 4: 미리보기·원자적 기록과 CI 재현

**Files:** 생성 `scripts/check-stack-versions.mjs`, `scripts/stack-versions/record.mjs`, `tests/stack-version-cli-test.mjs`.
생성 `plugins/harness-guard/scripts/check-stack-record.mjs` 정본과 루트 `scripts/check-stack-record.mjs` CLI wrapper.
수정 생성기의 Task1 함수와 개별 CI job; 기록 검사기 정본은 셋업에서 소비 repo의 `scripts/check-stack-record.mjs`로 전달한다.
**Interfaces:** CLI는 `--project`, `--stack`, `--framework`, `--ui`, 반복 `--version role.component=exact|latest`, `--apply`만 받는다.
`writeVersionRecord(projectRoot:string,result:VersionResult): string`은 성공 시 새 기록 경로를 반환한다. `checkStackRecord(root,record): {valid,issues}`는 무의존이다.
- [ ] `preview_and_atomic_apply`·`ci_input_drift` 시험을 작성한다. CLI는 임시 fixture에서 subprocess로 실행한다.
```js
assert.deepEqual(afterPreview, beforePreview);
assert.equal(applyAfterInputChange.status, 1); assert.equal(applyOverSymlink.status, 1);
assert.equal(checkStackRecord(changedProject, savedRecord).valid, false);
```
기존 기록 덮어쓰기 거부·저장 중 실패의 임시 파일 정리·conflict/unverified 시 파일 부재도 시험한다.
- [ ] `node --test tests/stack-version-cli-test.mjs`: CLI 부재로 RED.
- [ ] Task1~3을 호출해 JSON 결과와 조치를 출력한다. compatible=0, conflict/unverified=1, 잘못된 CLI=2다.
`--apply` 직전 입력 digest를 재확인하고 동일 폴더 임시 파일→exclusive 공개로 `harness-stack.versions.json`을 저장한다.
기존 파일/symlink를 덮어쓰지 않는다. 기록은 schema1·exact·출처/시각·지문·판정만 저장하며 결과가 같아도 기존 파일은 보존한다.
생성 CI는 해당 exact runtime과 lockfile을 사용하고 먼저 기록/입력 지문을 검사한다. CI에서 latest·새 metadata를 조회하지 않는다.
체크아웃의 `.runtime` tooling이나 외부 설치본에 의존하지 않는 record checker를 배치한다. record는 선택·지문이 일치할 때만 소비한다. 기존 명령·권한·action SHA를 유지한다.
- [ ] `node --test tests/stack-version-cli-test.mjs`와 `bash tests/stack-templates-test.sh`: PASS; 부작용·drift 거부 사례 포함.
- [ ] 커밋 `feat(stack): 버전 미리보기와 재현 기록 추가`.

### Task 5: 셋업·repo-sync의 선택과 실패 경계 연결

**Files:** 수정 `scripts/new-repo.sh`, `plugins/harness-guard/scripts/check-repo-sync.mjs`, `tests/{new-repo,repo-sync}-test.sh`.
**Interfaces:** 셋업은 Selection→Inspection→VersionResult→renderSelectedWorkflow 순서로 호출한다. 실패 판정은 복사/protection 전에 종료한다.
repo-sync의 실제 구현은 plugin 안에 있다. 루트 `scripts/check-repo-sync.mjs`는 호환 wrapper로 유지한다.
- [ ] `setup_profile_and_prewrite_refusal`·`sync_profile_and_drift` 시험을 기존 shell 시험에 추가한다.
```js
assert.equal(rejectedSetup.ghWrites, 0); assert.deepEqual(rejectedSetup.filesAfter, rejectedSetup.filesBefore);
assert.ok(syncNuxt.rules.includes('vue')); assert.ok(syncDjango.rules.includes('django'));
assert.equal(syncVersionDrift.versionStatus, 'unverified');
```
프레임워크 선택·Hotwire/Inertia 같은 앱 처리·사용자 CI 보존·metadata timeout·루트 wrapper와 저장소 없는 plugin fixture의 동일 결과를 함께 검증한다.
- [ ] `bash tests/new-repo-test.sh`, `bash tests/repo-sync-test.sh`: 새 필드/검사 부재로 RED; 기존 사례 보존.
- [ ] 대화형 profile/UI/버전 입력을 연결한다. 버전 판정·기록 새 저장 가능성·CI 보존 충돌을 실제 쓰기 전에 확인한다.
원자적 기록을 저장한 뒤 파일을 배치한다. 보존한 사용자 CI가 기록을 소비하지 않으면 적용 완료로 보고하거나 원격 보호를 변경하지 않는다.
기존 명령·번호는 그대로 받되 셋업은 같은 버전 gate를 거친다. 범용 Python의 검사 범위도 표시하며 미확인은 쓰기 전에 nonzero다.
rule 배치·repo-sync 탐지도 카탈로그와 plugin 안의 inspector/record checker를 재사용한다.
설치된 plugin에 저장소 루트가 없어도 같은 디렉터리 정본을 읽는다. 카탈로그/기록 부재는 기존 탐지와 버전 미확인을 구분한다. 실제 소비 remote/gh mutation 시험은 하지 않는다.
- [ ] 두 shell 시험·`node --test tests/local-setup-test.mjs`: PASS; 기존 Spring Boot/Vue·12조합과 거부 전 무변경 확인.
- [ ] 커밋 `feat(stack): 셋업과 드리프트 검사에 프로필 연결`.

### Task 6: 공식 링크·실무 안내·동작 버전과 최종 검증

**Files:** 생성 `templates/stacks/react/rules/react.md`, `nuxt/rules/nuxt.md`, `python/frameworks/{django,fastapi,flask}/rules/<framework>.md`.
생성 `templates/stacks/rails/ui/{hotwire,inertia-react,inertia-vue,api}/rules/<ui>.md`; 수정 기존 Python/Ruby/Vue/Next.js rule과 카탈로그 ruleSources.
수정 `docs/{repository-structure,local-development,stack-guide,stack-troubleshooting-frontend,stack-troubleshooting-backend}.md`, 두 스펙·README·CHANGELOG·두 plugin manifest.
**Interfaces:** 공통 TypeScript→React/Vue 또는 Python/Ruby→선택한 전문 rule→필요한 공식 링크의 읽기 경로를 문서·셋업이 공유한다.
- [ ] `rule_sources_and_scope` 사례를 stack/new-repo 시험에 추가한다: Next.js는 React, Nuxt는 Vue도 배치; Python/Rails 전문 rule 누락 시 FAIL.
- [ ] `bash tests/stack-templates-test.sh`, `bash tests/new-repo-test.sh`: 신규 rule 경로 누락으로 RED.
- [ ] rule은 공식 설명을 major/주제 링크로 연결하고 조건·비용·단순 대안·진단·재발 검사를 쓴다. 공식 내용/검증한 실무 판단을 구분한다.
React 상태·서버 경계, Nuxt hydration/요청 상태, Django/Flask escaping·CSRF, FastAPI async 경계, Inertia props/폼·Hotwire navigation을 다룬다.
CQRS/outbox/BFF는 필요 조건이 있는 선택이다. 특정 소비자·고정 운영 수치·DB 제품을 강제하지 않는다.
Spring Boot API 중심 안내와 Thymeleaf 지원/추세 한계를 유지한다. 공식 출처·199줄·필수 계약은 내용 검토로도 확인한다.
Task1에서 올린 소스 후보0.91.0과 두 manifest·README를 대조한다. 커밋 후 changelog 생성/검사를 수행한다; 태그/발행은 하지 않는다.
- [ ] 해당 시험·Markdown/참조 검사·`git diff --check` PASS 후, `.github/workflows/ci-gate.yml` quality의 현재 모든 명령을 그대로 실행한다.
각 명령·후보·최초 실패/수정·재시도·미실행을 보존한다. 테스트 fixture와 실제 앱/원격 CI/설치 증거는 구분한다.
- [ ] 커밋 `feat(stack): 공식 안내와 조건부 실무 기준 연결`; `node scripts/generate-changelog.mjs --release v0.91.0 --write` 후 별도 기록 커밋/`--check`.
- [ ] 구현자와 다른 읽기 전용 인스턴스가 명세·현재 고정 후보·정상/거부 경계·harness-doc-sync 대상 누락을 검토한다. 필수 FAIL/미확인이면 종료 금지.
- [ ] 실제 결과로 스펙·체크리스트·지도 갱신, 변경 범위·잔여 제약을 전달한다. 구현 수용 기준 충족 후 종료하며 delivery를 자동 추가하지 않는다.

## 이번 계획의 자체 검토와 전달

명세 요구→Task1~6, Review Focus→해당 시험, 인터페이스·단계 순서·legacy 호환·scope를 대조했다.
현재는 사용자 승인에 따른 Native 구현 단계다. 각 시험·tooling 준비·동작 변경은 실행 증거로 확인한다.
같은 구현자가6작업을 순서대로 수행하고 마지막에 독립 검토한다. 실제 앱/원격 CI/설치는 미확인 범위로 구분한다.
