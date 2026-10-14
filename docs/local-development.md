# 로컬 스택 검사 연결

준비된 제품에 `scripts/check-harness.sh` 하나를 추가한다. `--stack`으로 단독 스택을 명시한다.
로컬 조합과 자동 기본 선택은 제공하지 않는다. GitHub 계정·원격 저장소는 필요하지 않다.
GitHub 셋업·CI의 백엔드+프론트엔드 조합은 [저장소 구조 안내](repository-structure.md)를 따른다.
앱 생성·검사 도구 초기 설정·package.json 변경·DB·인프라 준비는 포함하지 않는다.

## 지원과 준비 조건

Team Harness checkout과 Node.js 22+, Bash가 필요하다. 지원 조회는 제품 파일을 읽거나 실행하지 않는다.

```bash
node /path/to/team-harness/scripts/setup-local.mjs --list
```

| 단독 선택 | 실행 방식 | 필수 scripts | 선언하면 실행하는 scripts |
|---|---|---|---|
| `spring-boot` (`spring` 별칭) | Gradle | `./gradlew check bootJar` | 없음 |
| `vue` | npm | `type-check`, `lint`, `test:unit`, `build`, `test:e2e` | 없음 |
| `node` | npm | `lint`, `test`, `build` | `type-check`, `lint:design` |
| `react` (React/Vite) | npm | `lint`, `type-check`, `test:unit`, `build` | 없음 |
| `nextjs` | npm | `lint`, `build` | `type-check`, `lint:design`, `test` |
| `nuxt` | npm | `lint`, `type-check`, `test:unit`, `build` | 없음 |

Python·Rails의 로컬 프로필, Maven·pnpm·yarn·bun 실행은 지원하지 않는다.
Spring Boot는 실행 가능한 `gradlew`와 `build.gradle` 또는 `build.gradle.kts`가 필요하다.
npm은 `package.json`·`package-lock.json`이 필요하다. 다른 lockfile과 `npm-shrinkwrap.json`이 있으면 중단한다.
`packageManager`를 선언했다면 `npm@버전`이어야 한다. 다른 실행기로 자동 전환하지 않는다.
React/Vite는 `react`·`vite`, Next.js는 `next`·`react`, Nuxt는 `nuxt`, Vue는 `vue` 의존성을 확인한다.
Vue는 `@playwright/test`도 필수다. 누락·빈 명령은 거부하며 항상 성공하는 명령을 채우지 않는다.

Node·React·Next.js·Nuxt의 E2E는 `--e2e`로 선택한다. 선택하면 `@playwright/test` 의존성과
`test:e2e`가 필수다. Vue E2E는 계속 필수이며 Spring Boot에는 `--e2e`를 사용할 수 없다.
선택하지 않은 E2E와 선언하지 않은 선택 scripts는 `NOT SELECTED`로 표시한다.
제품이 필수로 채택한 검사는 이 표의 선택 여부와 관계없이 제품 진입점에 계속 연결해야 한다.
공통 checker의 PASS를 제품 필수 검사의 생략을 허용하는 판정으로 쓰지 않는다.

## 선택·미리보기·적용

```bash
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/spring-app" --stack spring-boot
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/vue-app" --stack vue
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/react-app" --stack react --e2e

# 준비 조건·명령 미리보기를 확인한 뒤 같은 선택으로 파일 하나 생성
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/react-app" --stack react --e2e --apply

# 생성 내용을 검토한 뒤 실행; 어느 작업 디렉터리에서도 제품 루트를 찾음
bash "/path/to/react-app/scripts/check-harness.sh"
```

기본은 미리보기다. 파일 쓰기·네트워크·설치·검사를 수행하지 않는다.
`--apply`도 검사 실행 없이 checker 하나만 배타적으로 생성한다. 기존 목적 파일은 내용이 같아도 덮어쓰지 않는다.
프로젝트 경로의 링크·링크된 필수 파일·scripts 링크와 기존 목적 파일은 쓰기 전에 거부한다.
시스템 별칭 경로도 링크이면 거부하므로 실제 프로젝트 경로를 사용한다.
단독 스택은 지정한 제품 루트에서 검사하며 `--backend-dir`·`--frontend-dir` 옵션은 지원하지 않는다.
AGENTS.md·기존 check-local.sh·앱 설정·.env·데이터·Git·CI 설정을 적용 과정에서 수정하지 않는다.

Spring Boot는 `./gradlew check bootJar`다. npm은 먼저 `npm ci`를 수행한다.
Vue는 type-check → lint → test:unit → build → Chromium 준비 → test:e2e 순서를 유지한다.
Node는 lint → 선언된 type-check → 선언된 lint:design → test → build 순서다.
Next.js는 lint → 선언된 type-check → 선언된 lint:design → 선언된 test → build 순서다.
React·Nuxt는 lint → type-check → test:unit → build 순서다.
선택한 신규 E2E는 build 다음 프로젝트 Playwright로 Chromium 준비 → test:e2e를 수행한다.
어느 단계든 실패하면 후속 명령 없이 멈추며 PASS를 표시하지 않는다.
실제 실행은 제품의 Gradle/npm 명령과 설치 스크립트를 수행하므로 검토·관리하는 프로젝트에서 사용한다.

## 정본·제품 검사와 한계

`templates/stacks.json`의 `localProfile`이 준비 조건·선택 명령·미리보기를 연결한다.
기존 Spring Boot·Vue의 명령 원문은 해당 스택의 `local-check.sh`와 `localCheck`로 유지한다.
공통 실행 틀은 `templates/local/check-harness.sh`다. 생성된 파일은 Harness checkout 없이 동작하며 제품에서 관리한다.
업데이트는 생성 정본과 제품 파일을 검토하여 필요한 차이만 직접 반영한다.
Java·프론트 기준은 [스택 rule 원문](repository-structure.md#스택-템플릿을-바꿀-때)과
[프론트 검증 기준](frontend-design-standards.md#8-검증-pr-전-프레임워크-무관)을 따른다.

제품 AGENTS.md에 진입점을 연결하고 제품 전용 검사도 유지한다. 기존 check-local.sh에 같은 공통 단계가
있으면 중복 실행하지 말고 기존 진입점을 유지하거나 내용을 검토해 통합한다.
DB 재시작 보존·E2E 서버 실행·이미지 복원·파일 변경은 제품 설정에서 확인한다.
준비 조건 검사는 선언의 존재를 확인하며 실제 통과·검사 충실도·보안 격리를 증명하지 않는다.
회귀 검사는 명령 실행 경계를 격리 대역으로 확인한다. 실제 앱 검사는 별도 실행 증거가 필요하다.
Playwright Test를 유지하며 [도구 선택 근거](decisions.md#브라우저-자동화-도구-선택-2026-09-22)를 따른다.
기존 조합의 당시 결과는 [과거 명세](specs/local-spring-vue-setup.md), 현재 변경 범위는
[workflow 성숙도 스펙](specs/workflow-maturity.md)에서 확인한다.
스택 버전·GitHub 셋업은 [별도 버전 안내](stack-versions.md), 회사 인수는
[회사 인수 계약](company-acceptance.md)을 따른다. 각각의 검증 결과를 합치지 않는다.
