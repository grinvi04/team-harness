# 로컬 Spring Boot·Vue 검사 연결

준비된 Spring Boot 또는 Vue 프로젝트에 공통 검사 진입점 하나를 추가한다.
개별 검사를 선택하거나 기존 Spring Boot+Vue 조합을 사용한다. GitHub 계정·원격 저장소는 필요하지 않다.
앱 생성·검사 도구 초기 설정·package.json 변경·DB·인프라 준비는 포함하지 않는다.

## 준비 조건과 정본

- Team Harness checkout과 Node.js 22+, Bash. 실제 검사에는 제품이 요구하는 JDK·npm과 의존성 다운로드가 필요하다.
- Spring Boot: 선택한 디렉터리에 실행 가능한 `gradlew`, `build.gradle` 또는 `build.gradle.kts`.
- Vue: 선택한 디렉터리에 `package.json`·`package-lock.json`, Vue·`@playwright/test` 의존성.
- Vue scripts에 `type-check`, `lint`, `test:unit`, `build`, `test:e2e`가 모두 설정되어 있어야 한다.

부족한 항목은 오류로 알린다. 빈 검사나 항상 성공하는 명령으로 채우지 않는다.
Java 검사 연결은 [Java 기준](../templates/stacks/spring-boot/rules/java.md), Vue 타입·lint·단위 검사는
[Vue 기준](../templates/stacks/vue/rules/vue.md), 브라우저·접근성 범위는
[프론트 검증 기준](frontend-design-standards.md#8-검증-pr-전-프레임워크-무관)을 따른다.

명령 정본은 `templates/stacks/spring-boot/local-check.sh`·`templates/stacks/vue/local-check.sh`다.
`templates/stacks.json`의 `localCheck`가 두 경로를 연결하고 `templates/local/check-harness.sh`가
공통 실행 틀을 제공한다. 생성된 파일은 Harness checkout 없이 동작하며 이후 제품에서 관리한다.
Spring Boot 이미지 예시 `templates/stacks/spring-boot/Dockerfile`은 기존 Gradle Groovy 프로젝트를 전제로 한다.
`templates/stacks/nextjs/Dockerfile`은 Next.js standalone 출력용 예시다.

## 선택·미리보기·적용

```bash
# 옵션 없는 기존 경로: backend Spring Boot + frontend Vue, 미리보기만 수행
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/my-project"

# 단독 선택은 지정한 프로젝트 루트에서 검사
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/spring-app" --stack spring-boot
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/vue-app" --stack vue

# 명시적 조합: 기본 backend/frontend 또는 조합에서만 상대 경로 지정
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/my-project" \
  --stack spring-boot+vue --backend-dir apps/api --frontend-dir apps/web

# 같은 옵션에 --apply를 추가하면 scripts/check-harness.sh 하나만 생성
node /path/to/team-harness/scripts/setup-local.mjs --project "/path/to/my-project" --apply

# 생성 내용을 검토한 뒤 실행; 어느 작업 디렉터리에서도 제품 루트를 찾음
bash "/path/to/my-project/scripts/check-harness.sh"
```

기본은 미리보기이며 파일 쓰기·설치·검사를 수행하지 않는다. 지원 선택은 `spring-boot`·`vue`·`spring-boot+vue`다.
다른 스택과 단독 선택의 경로 옵션, 경로 탈출·같은 조합 경로는 거부한다.
조합 경로는 프로젝트 안의 상대 경로이며 각 구성 디렉터리·필수 파일은 심볼릭 링크를 허용하지 않는다.

Spring Boot는 `./gradlew check bootJar`를 실행한다. Vue는 `npm ci` → `npm run type-check` →
`npm run lint` → `npm run test:unit` → `npm run build` → 프로젝트 Playwright로 Chromium 준비 →
`npm run test:e2e` 순서다. 조합은 Spring Boot 다음 Vue다. 어느 단계든 실패하면 멈추고 PASS를 표시하지 않는다.
실제 실행은 제품의 Gradle/npm 명령과 설치 스크립트를 수행하므로 검토·관리하는 프로젝트에서 사용한다.

기존 목적 파일은 내용이 같아도 덮어쓰지 않는다. scripts가 링크이거나 목적 파일이 있으면 중단한다.
AGENTS.md·기존 check-local.sh·앱 설정·데이터·Git 설정은 적용 과정에서 수정하지 않는다.
업데이트는 생성 정본과 제품 파일을 검토하여 필요한 차이만 직접 반영한다.

## 제품에 남길 검사와 한계

제품 AGENTS.md에 진입점을 연결하고 제품 전용 검사도 유지한다. 기존 check-local.sh에 같은 공통 단계가
있으면 중복 실행하지 말고 기존 진입점을 유지하거나 내용을 검토해 통합한다.
DB 재시작 보존·E2E 이미지 복원 등 제품별 처리는 이 공통 구성에 포함되지 않는다.
E2E의 파일 변경·서버 실행은 제품 설정에서 확인한다.

준비 조건 검사는 파일·명령 선언의 존재를 확인한다. 설정의 충실도·실제 통과·보안 격리를 증명하지 않는다.
회귀 검사는 제품 명령 실행 경계를 격리 대역으로 확인하며 실제 앱의 Gradle·브라우저 검사는 제품이 수행한다.
변경한 코드는 해당 검사를 다시 실행하고 동일 후보·환경·범위의 증거만 재사용한다.
Playwright Test를 유지하며 Stagehand v4로 자동 교체하지 않는다.
[도구 선택 근거](decisions.md#브라우저-자동화-도구-선택-2026-09-22)를 따른다.
기존 조합의 당시 결과는 [원래 명세](specs/local-spring-vue-setup.md), 이번 변경 범위는
[후속 구조 정리](specs/structure-cleanup.md), 제품 우선순위는 [로드맵](product-direction.md)에서 확인한다.

스택 버전 미리보기·기록과 GitHub 셋업은 [별도 버전 안내](stack-versions.md)를 따른다.
이 로컬 실행 연결과 버전 metadata 검사를 같은 검증 결과로 합치지 않는다. `spring` 입력은 호환 별칭이다.
